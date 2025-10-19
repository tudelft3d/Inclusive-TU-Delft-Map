import logging
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from tqdm import tqdm

from cj_geometry import Geometry, IconPosition, MultiSurface
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
    CityJSONSpace,
    CityJSONSpaceSubclass,
)
from csv_utils import csv_read_attributes
from geometry_utils import flatten_trimesh, merge_trimeshes, orient_polygons_z_up


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


def _geom_and_name_from_scene_id(
    scene: trimesh.Scene, object_id: str
) -> tuple[Geometry, str]:
    mesh = _get_scene_geometry_from_id(scene=scene, object_id=object_id)
    lod = int(object_id[-1])
    name = object_id[:-6]
    if lod == 0:
        orient_polygons_z_up(mesh)
    return MultiSurface.from_mesh(lod=lod, mesh=mesh), name


def _unit_code_to_parent(code: str) -> str:
    if len(code) == 0:
        raise ValueError(f"Code '{code}' is not a correct value.")
    if code == BuildingUnitContainer.main_parent:
        raise ValueError(f"BuildingUnitContainer.main_parent does not have a parent.")
    elif len(code) == 1:
        return BuildingUnitContainer.main_parent
    elif len(code) == 2:
        return code[:-1]
    else:
        return code[:-2]


def load_attributes_from_csv(
    csv_path: Path, id_column: str
) -> dict[str, dict[str, Any]]:
    attributes_all, specific_values_all = csv_read_attributes(
        csv_path=csv_path, specific_columns=(id_column,)
    )
    id_to_attributes: dict[str, dict[str, Any]] = {}
    for i in range(len(attributes_all)):
        _, id_value = specific_values_all[i][0]
        id_to_attributes[id_value] = attributes_all[i]
    return id_to_attributes


def load_units_from_csv(
    cj_file: CityJSONFile,
    csv_path: Path,
    code_column: str,
    spaces_column: str,
) -> None:
    root_pos = cj_file.get_root_position()
    root = cj_file.city_objects[root_pos]
    if not isinstance(root, Building):
        raise RuntimeError(
            f"The root of the `cj_file` should be a Building, not a {type(root)}"
        )
    prefix = CityJSONSpace.space_number_to_prefix(number=root.space_id)

    all_units: dict[str, list[BuildingUnit]] = defaultdict(lambda: [])

    # Process the CSV file to find all the units
    unit_to_spaces: dict[str, list[str]] = {}
    specific_columns = (code_column, spaces_column)
    attributes_all, specific_values_all = csv_read_attributes(
        csv_path=csv_path, specific_columns=specific_columns
    )
    for attributes, specific_values in zip(attributes_all, specific_values_all):
        _, unit_code = specific_values[0]
        _, unit_spaces = specific_values[1]

        current_units_same_code = len(all_units[unit_code])
        unit_id = BuildingUnit.unit_code_to_id(
            code=unit_code, prefix=prefix, number=current_units_same_code
        )

        unit = BuildingUnit(
            object_id=unit_id,
            unit_code=unit_code,
            attributes=attributes,
        )
        unit_to_spaces[unit.id] = unit_spaces
        all_units[unit_code].append(unit)

    # Add the missing hierarchy in the codes
    main_container_id = BuildingUnitContainer.unit_code_to_id(code="", prefix=prefix)
    all_unit_containers: dict[str, BuildingUnitContainer] = {
        BuildingUnitContainer.main_parent: BuildingUnitContainer(
            object_id=main_container_id, unit_code=""
        )
    }
    current_codes = list(all_units.keys())
    for code in current_codes:
        while code != BuildingUnitContainer.main_parent:
            if not code in all_units.keys():
                all_units[code] = []
            if not code in all_unit_containers.keys():
                obj_id = BuildingUnitContainer.unit_code_to_id(code=code, prefix=prefix)
                all_unit_containers[code] = BuildingUnitContainer(
                    object_id=obj_id, unit_code=code
                )
            code = _unit_code_to_parent(code=code)

    # Extract all the spaces from the given CityJSON file
    spaces_ids_to_pos = {}
    for i, cj_obj in enumerate(cj_file.city_objects):
        # We search for the actual spaces
        if isinstance(cj_obj, CityJSONSpaceSubclass):
            spaces_ids_to_pos[cj_obj.space_id] = i

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
        for space_id in unit_to_spaces[unit.id]:
            cj_file_pos = spaces_ids_to_pos[space_id]
            space = cj_file.city_objects[cj_file_pos]
            assert isinstance(space, CityJSONSpaceSubclass)
            CityJSONObject.add_unit_space(unit=unit, space=space)

    # Compute the icon positions of the units
    for unit in all_units_flattened:
        meshes: list[trimesh.Trimesh] = []
        for space_id in unit_to_spaces[unit.id]:
            cj_file_pos = spaces_ids_to_pos[space_id]
            space = cj_file.city_objects[cj_file_pos]
            assert isinstance(space, CityJSONSpaceSubclass)
            if space.geometries is None:
                continue
            best_idx = 0
            for idx in range(1, len(space.geometries)):
                if space.geometries[idx].lod > space.geometries[best_idx].lod:
                    best_idx = idx
            meshes.append(space.geometries[best_idx].to_trimesh())

        if len(meshes) == 0:
            continue

        merged_mesh = merge_trimeshes(meshes=meshes, fix_geometry=False)
        icon_position = IconPosition.from_mesh(
            merged_mesh, z_offset=BuildingUnit.icon_z_offset
        )
        unit.set_icon(icon_position=icon_position)

    cj_file.add_cityjson_objects(list(all_unit_containers.values()))
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

    logging.info("Add the missing hierarchy.")

    # Add the missing hierarchy without geometry
    current_objects = list(all_objects_geoms.keys())
    for obj_name in current_objects:
        last_dot_position = obj_name.rfind(".")
        while last_dot_position != -1:
            parent_name = obj_name[:last_dot_position]
            if parent_name not in all_objects_geoms.keys():
                all_objects_geoms[parent_name] = []
            last_dot_position = parent_name.rfind(".")

    logging.info("Transform into actual CityJSON objects.")

    # Store the geometry into actual objects
    all_objects_cj: dict[str, CityJSONObjectSubclass] = {}
    for name, geoms in all_objects_geoms.items():
        hierarchy_level = name.count(".")
        if hierarchy_level == 0:
            obj_func = Building
        elif hierarchy_level == 1:
            obj_func = BuildingPart
        elif hierarchy_level == 2:
            obj_func = BuildingStorey
        elif hierarchy_level == 3:
            obj_func = BuildingRoom
        else:
            raise RuntimeError(f"Unexpected format for an object name: '{name}'")

        obj_id = obj_func.space_number_to_id(number=name)

        all_objects_cj[name] = obj_func(
            object_id=obj_id, space_id=name, geometries=geoms
        )

    # # Add the root group
    # root = BuildingRoot(object_id=f"Root-08")

    logging.info("Apply the parent-child relationships.")

    # Apply the parent-child relationships
    for obj_name in all_objects_cj.keys():
        last_dot_position = obj_name.rfind(".")
        if last_dot_position != -1:
            obj_parent_name = obj_name[:last_dot_position]
            CityJSONObject.add_parent_child(
                parent=all_objects_cj[obj_parent_name], child=all_objects_cj[obj_name]
            )
        # else:
        #     CityJSONObject.add_parent_child(parent=root, child=all_objects_cj[obj_name])

    cj_file = CityJSONFile(
        scale=np.array([0.00001, 0.00001, 0.00001], dtype=np.float64),
        translate=np.array([0, 0, 0], dtype=np.float64),
    )
    # cj_file.add_cityjson_objects([root])
    cj_file.add_cityjson_objects(list(all_objects_cj.values()))

    logging.info("Done processing the full building.")

    return cj_file
