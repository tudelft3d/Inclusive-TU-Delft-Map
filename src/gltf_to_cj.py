import csv
from collections import defaultdict
from collections.abc import Iterable
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from tqdm import tqdm

from cj_geometry import Geometry, MultiSurface
from cj_objects import (
    Building,
    BuildingPart,
    BuildingRoom,
    BuildingStorey,
    BuildingUnit,
    BuildingUnitContainer,
    CityJSONFile,
    CityJSONObject,
    CityJSONObjectSubclass,
)
from geometry_utils import flatten_trimesh, orient_polygons_z_up


def _get_scene_geometry_from_id(
    scene: trimesh.Scene, object_id: str
) -> trimesh.Trimesh:
    # Load the geometry
    transform, geometry_name = scene.graph.get(frame_to=object_id)
    geometry_local = scene.geometry[geometry_name]

    # Transform to global coordinates
    geometry: trimesh.Trimesh = geometry_local.copy()
    geometry.apply_transform(transform)

    # Handle incorrect axes
    geometry.vertices = geometry.vertices[:, [2, 0, 1]]
    geometry.vertices[:, [0, 1]] = -geometry.vertices[:, [0, 1]]

    # Fix the 3D geometry
    geometry.process(validate=True)
    geometry.fill_holes()
    geometry.fix_normals()

    return geometry


# def extract_objects_first_level_gltf(gltf_path: Path) -> dict[str, trimesh.Trimesh]:
#     # Load the scene
#     scene = trimesh.load_scene(gltf_path)
#     nodes_names: list[str] = scene.graph.nodes_geometry

#     geometries = {}

#     for node_name in nodes_names:
#         geometry = get_scene_geometry_from_id(scene=scene, object_id=node_name)
#         geometries[node_name] = geometry

#     return geometries


# def building_parts_from_gltf(gltf_path: Path, id_prefix: str) -> list[BuildingPart]:
#     geometries_3D = extract_objects_first_level_gltf(gltf_path=gltf_path)
#     bdg_parts: list[BuildingPart] = []

#     for bdg_part_name, geometry_3D in geometries_3D.items():
#         # Fix the 3D geometry
#         geometry_3D.process(validate=True)
#         geometry_3D.fill_holes()
#         geometry_3D.fix_normals()

#         # Build the geometry part
#         bdg_part_geometry_2D = MultiSurface.from_mesh(
#             lod=0, mesh=flatten_trimesh(geometry_3D)
#         )
#         bdg_part_geometry_3D = MultiSurface.from_mesh(lod=2, mesh=geometry_3D)

#         # Extract all the triangles into Polygons
#         bdg_part_id = id_prefix + bdg_part_name
#         room = BuildingPart(
#             object_id=bdg_part_id,
#             attributes={"name": bdg_part_name},
#             geometries=[bdg_part_geometry_2D, bdg_part_geometry_3D],
#         )
#         bdg_parts.append(room)

#     return bdg_parts


# def building_rooms_from_gltf(gltf_path: Path, id_prefix: str) -> list[BuildingRoom]:
#     geometries = extract_objects_first_level_gltf(gltf_path=gltf_path)
#     rooms: list[BuildingRoom] = []

#     for room_name, geometry in geometries.items():
#         # Fix the orientation
#         orient_polygons_z_up(geometry)

#         # Build the geometry part
#         room_geometry = MultiSurface.from_mesh(lod=0, mesh=geometry)

#         # Extract all the triangles into Polygons
#         room_id = id_prefix + room_name
#         room = BuildingRoom(
#             object_id=room_id,
#             attributes={"name": room_name},
#             geometries=[room_geometry],
#         )
#         rooms.append(room)

#     return rooms


def _geom_and_name_from_scene_id(
    scene: trimesh.Scene, object_id: str
) -> tuple[Geometry, str]:
    mesh = _get_scene_geometry_from_id(scene=scene, object_id=object_id)
    lod = int(object_id[-1])
    name = object_id[:-6]
    if lod == 0:
        orient_polygons_z_up(mesh)
    return MultiSurface.from_mesh(lod=lod, mesh=mesh), name


def _csv_format_type(value: Any, column_type: str) -> Any:
    if column_type == "str":
        return str(value)
    elif column_type == "float":
        if value == "":
            return None
        return float(value.replace(",", "."))
    elif column_type == "int":
        if value == "":
            return None
        return int(value)
    elif column_type.startswith("list"):
        if value == "":
            return []
        list_info = column_type[len("list") :]
        separator = list_info[0]
        other_type = list_info[1:]
        return [
            _csv_format_type(value=v, column_type=other_type)
            for v in value.split(separator)
        ]
    else:
        raise NotImplementedError(
            f"Support for type '{column_type}' is not implemented yet."
        )


def _csv_get_row_value(row: dict[str, Any], column: str) -> tuple[str, Any]:
    value = row[column]
    column_split = column.split(" [")
    if len(column_split) != 2:
        raise RuntimeError(
            f"The column name should look like this: '<Name> [<type>]', but it is '{column}'."
        )
    column_type = column_split[1][:-1]
    column_name = column_split[0]
    return column_name, _csv_format_type(value=value, column_type=column_type)


def _unit_code_to_parent(code: str) -> str:
    if code == BuildingUnitContainer.main_parent:
        raise ValueError(f"BuildingUnitContainer.main_parent does not have a parent.")
    elif len(code) == 1:
        return BuildingUnitContainer.main_parent
    elif len(code) == 2:
        return code[:-1]
    else:
        return code[:-2]


def _unit_code_to_id(code: str, prefix: str) -> str:
    return f"{BuildingUnitContainer.type_name}-{prefix}-{code}"


def load_attributes_from_csv(
    csv_path: Path, id_column: str
) -> dict[str, dict[str, Any]]:
    attributes = {}
    with open(csv_path, encoding="utf-8-sig") as csvfile:
        reader = csv.DictReader(csvfile, delimiter=";")
        for row in reader:
            # Skip empty rows
            if not any(cell != "" for cell in row.values()):
                continue
            # Process the row
            col_name, id_value = _csv_get_row_value(row=row, column=id_column)
            if id_value in attributes:
                raise RuntimeError(
                    f"Column {id_column} cannot be they key, because multiple rows share the same value (e.g. {id_value})."
                )
            row_attributes = {}
            for col_name_type in row.keys():
                # Skip columns that don't have a type
                if col_name_type.find(" [") == -1:
                    continue
                # Add the column and its value to the attributes
                col_name, col_value = _csv_get_row_value(row=row, column=col_name_type)
                if col_name in row_attributes:
                    raise RuntimeError(
                        f"Two columns have the same name '{col_name}' in {str(csv_path)}"
                    )
                row_attributes[col_name] = col_value

            attributes[id_value] = row_attributes
    return attributes


def load_units_from_csv(
    cj_file: CityJSONFile,
    csv_path: Path,
    code_column: str,
    spaces_column: str,
) -> None:
    root_pos = cj_file.get_root_position()
    prefix_ids = cj_file.city_objects[root_pos].id.replace("-", "_")

    all_units: dict[str, list[BuildingUnit]] = defaultdict(lambda: [])

    # Process the CSV file to find all the units
    with open(csv_path, encoding="utf-8-sig") as csvfile:
        reader = csv.DictReader(csvfile, delimiter=";")
        for row in reader:
            # Skip empty rows
            if not any(cell != "" for cell in row.values()):
                continue
            # Process the row
            code_column_name, code_value = _csv_get_row_value(
                row=row, column=code_column
            )

            unit_container_id = _unit_code_to_id(code=code_value, prefix=prefix_ids)
            unit_id = f"{unit_container_id}@{len(all_units[code_value])}"

            # Load the columns that contain a type as attributes
            attributes = {}
            for col_name_type in row.keys():
                # Skip columns that don't have a type
                if col_name_type.find(" [") == -1:
                    continue
                # Add the column and its value to the attributes
                col_name, col_value = _csv_get_row_value(row=row, column=col_name_type)
                # Rename the columns used specifically
                if col_name_type == spaces_column:
                    col_name = BuildingUnit.unit_children
                elif col_name_type == code_column:
                    col_name = CityJSONObject.unit_code
                if col_name in attributes:
                    raise RuntimeError(
                        f"Two columns have the same name '{col_name}' in {str(csv_path)}"
                    )
                attributes[col_name] = col_value

            bdg_unit = BuildingUnit(object_id=unit_id, attributes=attributes)
            all_units[code_value].append(bdg_unit)

    # Add the missing hierarchy in the codes
    all_unit_containers: dict[str, BuildingUnitContainer] = {
        BuildingUnitContainer.main_parent: BuildingUnitContainer(
            object_id=f"{BuildingUnitContainer.main_parent}-{prefix_ids}",
            attributes={CityJSONObject.unit_code: ""},
        )
    }
    current_codes = list(all_units.keys())
    for code in current_codes:
        while code != BuildingUnitContainer.main_parent:
            if not code in all_units.keys():
                all_units[code] = []
            if not code in all_unit_containers.keys():
                obj_id = _unit_code_to_id(code=code, prefix=prefix_ids)
                all_unit_containers[code] = BuildingUnitContainer(
                    object_id=obj_id, attributes={CityJSONObject.unit_code: code}
                )
            code = _unit_code_to_parent(code=code)

    # Extract all the spaces from the given CityJSON file
    spaces_ids_to_pos = {}
    for i, cj_obj in enumerate(cj_file.city_objects):
        space_id = cj_obj.attributes[CityJSONObject.space_id]
        spaces_ids_to_pos[space_id] = i

    # Apply the parent-child relationships of unit containers
    for code, unit_container in all_unit_containers.items():
        if code == BuildingUnitContainer.main_parent:
            CityJSONObject.add_parent_child(
                parent=cj_file.city_objects[root_pos],
                child=unit_container,
            )
            continue
        parent_code = _unit_code_to_parent(code=code)
        # Add the link to its parent
        CityJSONObject.add_parent_child(
            parent=all_unit_containers[parent_code], child=unit_container
        )
        # Add the link to its units
        for unit in all_units[code]:
            CityJSONObject.add_parent_child(parent=unit_container, child=unit)

    # Add the links from spaces to the units they belong in
    all_units_flattened = [unit for units in all_units.values() for unit in units]
    for unit in all_units_flattened:
        for space_id in unit.attributes[BuildingUnit.unit_children]:
            cj_file_pos = spaces_ids_to_pos[space_id]
            if (
                BuildingUnit.space_parents
                not in cj_file.city_objects[cj_file_pos].attributes
            ):
                cj_file.city_objects[cj_file_pos].add_attributes(
                    {BuildingUnit.space_parents: []}
                )
            cj_file.city_objects[cj_file_pos].attributes[
                BuildingUnit.space_parents
            ].append(unit.id)

    cj_file.add_cityjson_objects(all_unit_containers.values())
    cj_file.add_cityjson_objects(
        [unit for units in all_units.values() for unit in units]
    )


def full_building_from_gltf(gltf_path: Path) -> CityJSONFile:
    # Load the scene
    scene = trimesh.load_scene(gltf_path)

    graph: nx.DiGraph = scene.graph.to_networkx()  # type: ignore

    # Start from the root
    root_id = "world"

    # Get the scene collection
    all_objects_ids = list(graph.successors(root_id))
    all_objects_geoms: dict[str, list[Geometry]] = defaultdict(lambda: [])

    # Process all the objects and their geometries
    for obj_id in tqdm(all_objects_ids, desc="Process all geometries"):
        geom, name = _geom_and_name_from_scene_id(scene=scene, object_id=obj_id)
        all_objects_geoms[name].append(geom)

    # Add LoD 0 geometry to all objects that only have higher geometries
    for object_geoms in tqdm(
        all_objects_geoms.values(), desc="Build missing LoD 0 geometries"
    ):
        lods_to_geoms = {geom.lod: geom for geom in object_geoms}
        if len(lods_to_geoms) > 0 and not 0 in lods_to_geoms.keys():
            smallest_lod = min(lods_to_geoms.keys())
            base_mesh = lods_to_geoms[smallest_lod].to_trimesh()
            lod_0_mesh = flatten_trimesh(base_mesh)
            object_geoms.append(MultiSurface.from_mesh(lod=0, mesh=lod_0_mesh))

    # Add the missing hierarchy without geometry
    current_objects = list(all_objects_geoms.keys())
    for obj_name in current_objects:
        last_dot_position = obj_name.rfind(".")
        while last_dot_position != -1:
            parent_name = obj_name[:last_dot_position]
            if parent_name not in all_objects_geoms.keys():
                all_objects_geoms[parent_name] = []
            last_dot_position = parent_name.rfind(".")

    # Store the geometry into actual objects
    all_objects_cj: dict[str, CityJSONObjectSubclass] = {}
    for name, geoms in all_objects_geoms.items():
        hierarchy_level = name.count(".")
        if hierarchy_level == 0:
            obj_func = Building
            obj_prefix = "Building-"
        elif hierarchy_level == 1:
            obj_func = BuildingPart
            obj_prefix = "BuildingPart-"
        elif hierarchy_level == 2:
            obj_func = BuildingStorey
            obj_prefix = "BuildingStorey-"
        elif hierarchy_level == 3:
            obj_func = BuildingRoom
            obj_prefix = "BuildingRoom-"
        else:
            raise RuntimeError(f"Unexpected format for an object name: '{name}'")

        # Replace the dots in the name by hyphens
        obj_id = name.replace(".", "-")

        # Add the type to the object key
        obj_id = f"{obj_prefix}{obj_id}"

        # Store the initial key as an attribute
        attributes = {CityJSONObject.space_id: name}

        all_objects_cj[name] = obj_func(
            object_id=obj_id, geometries=geoms, attributes=attributes
        )

    # Apply the parent-child relationships
    for obj_name in all_objects_cj.keys():
        last_dot_position = obj_name.rfind(".")
        if last_dot_position != -1:
            obj_parent_name = obj_name[:last_dot_position]
            CityJSONObject.add_parent_child(
                parent=all_objects_cj[obj_parent_name], child=all_objects_cj[obj_name]
            )

    cj_file = CityJSONFile(
        scale=np.array([0.00001, 0.00001, 0.00001], dtype=np.float64),
        translate=np.array([0, 0, 0], dtype=np.float64),
    )
    cj_file.add_cityjson_objects(all_objects_cj.values())

    return cj_file
