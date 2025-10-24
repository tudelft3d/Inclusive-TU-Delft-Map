import logging
from collections import defaultdict
from pathlib import Path

import numpy as np
import trimesh
from tqdm import tqdm

from cj_attributes import (
    BdgAttr,
    BdgAttrReader,
    BdgRoomAttr,
    BdgRoomAttrReader,
    BdgUnitAttr,
    BdgUnitAttrReader,
)
from cj_geometry import Geometry, IconPosition, MultiSurface
from cj_objects import (
    Building,
    BuildingPart,
    BuildingRoom,
    BuildingStorey,
    BuildingUnit,
    BuildingUnitContainer,
    BuildingUnitObject,
    CityJSONFile,
    CityJSONObject,
    CityJSONObjectSubclass,
    CityJSONSpace,
    CityJSONSpaceSubclass,
)
from geometry_utils import flatten_trimesh, merge_trimeshes, orient_polygons_z_up


def _get_scene_geometry_from_id(scene: trimesh.Scene, cj_key: str) -> trimesh.Trimesh:
    # Load the geometry
    transform, geometry_name = scene.graph.get(frame_to=cj_key)
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
    scene: trimesh.Scene, cj_key: str
) -> tuple[Geometry, str]:
    mesh = _get_scene_geometry_from_id(scene=scene, cj_key=cj_key)
    lod = int(cj_key[-1])
    name = cj_key[:-6]
    if lod == 0:
        orient_polygons_z_up(mesh)
    return MultiSurface.from_mesh(lod=lod, mesh=mesh), name


def _unit_code_to_parent(code: str) -> str:
    if len(code) == 0:
        raise ValueError(f"Code '{code}' is not a correct value.")
    if code == BuildingUnitContainer.main_parent_code:
        raise ValueError(
            f"BuildingUnitContainer.main_parent_code does not have a parent."
        )
    elif len(code) == 1:
        return BuildingUnitContainer.main_parent_code
    elif len(code) == 2:
        return code[:-1]
    else:
        return code[:-2]


def _get_unit_geometry_from_id(scene: trimesh.Scene, cj_key: str) -> Geometry:
    mesh = _get_scene_geometry_from_id(scene=scene, cj_key=cj_key)
    orient_polygons_z_up(mesh)
    return MultiSurface.from_mesh(lod=0, mesh=mesh)


def load_units_from_csv(
    cj_file: CityJSONFile,
    csv_path: Path,
    gltf_path: Path | None,
    # code_column: str,
    # spaces_column: str,
) -> None:
    root_pos = cj_file.get_root_position()
    root = cj_file.city_objects[root_pos]
    if not isinstance(root, Building):
        raise RuntimeError(
            f"The root of the `cj_file` should be a Building, not a {type(root)}"
        )
    prefix = CityJSONSpace.key_to_prefix(key=root.cj_key)
    unit_main_container = BuildingUnitObject(prefix=prefix)
    CityJSONObject.add_parent_child(parent=root, child=unit_main_container)

    # Read the units geometry
    if gltf_path is not None:
        scene = trimesh.load_scene(gltf_path)

    all_units: dict[str, list[BuildingUnit]] = defaultdict(lambda: [])

    # Process the CSV file to find all the units
    unit_to_spaces: dict[str, list[str]] = {}
    units_attributes_all = BdgUnitAttrReader(csv_path=csv_path)
    units_attributes_iterator = units_attributes_all.iterator()
    for cj_key, units_attributes in units_attributes_iterator:
        unit_code = units_attributes.code

        # Get the potential geometry
        unit_geometry = None
        if gltf_path is not None:
            unit_gltf = units_attributes.unit_gltf
            if unit_gltf is not None:
                unit_geometry = _get_unit_geometry_from_id(
                    scene=scene, cj_key=unit_gltf
                )

        current_units_same_code = len(all_units[unit_code])
        unit_id = BuildingUnit.unit_code_to_cj_key(
            code=unit_code, prefix=prefix, index=current_units_same_code
        )

        unit = BuildingUnit(
            cj_key=unit_id,
            unit_code=unit_code,
            unit_storeys=units_attributes.unit_storeys,
            geometry=unit_geometry,
            attributes=units_attributes.attributes,
            icon_position=units_attributes.icon_position,
        )
        unit_to_spaces[unit.id] = units_attributes.unit_spaces
        all_units[unit_code].append(unit)

    unit_containers: list[BuildingUnitContainer] = []
    for code, units in all_units.items():
        unit_container_id = BuildingUnitContainer.unit_code_to_cj_key(
            code=code, prefix=prefix
        )
        unit_container = BuildingUnitContainer(
            cj_key=unit_container_id, unit_code=code, attributes={}
        )
        unit_containers.append(unit_container)

        CityJSONObject.add_parent_child(
            parent=unit_main_container, child=unit_container
        )
        for unit in units:
            CityJSONObject.add_parent_child(parent=unit_container, child=unit)

    # # Add the missing hierarchy in the codes
    # main_container_id = BuildingUnitContainer.unit_code_to_cj_key(
    #     code=BuildingUnitContainer.main_parent_code, prefix=prefix
    # )
    # all_unit_containers: dict[str, BuildingUnitContainer] = {
    #     BuildingUnitContainer.main_parent_code: BuildingUnitContainer(
    #         cj_key=main_container_id,
    #         unit_code=BuildingUnitContainer.main_parent_code,
    #     )
    # }
    # current_codes = list(all_units.keys())
    # for code in current_codes:
    #     while code != BuildingUnitContainer.main_parent_code:
    #         if not code in all_units.keys():
    #             all_units[code] = []
    #         if not code in all_unit_containers.keys():
    #             obj_key = BuildingUnitContainer.unit_code_to_cj_key(code=code, prefix=prefix)
    #             all_unit_containers[code] = BuildingUnitContainer(
    #                 cj_key=obj_key, unit_code=code
    #             )
    #         code = _unit_code_to_parent(code=code)

    # Extract all the spaces from the given CityJSON file
    spaces_ids_to_pos = {}
    for i, cj_obj in enumerate(cj_file.city_objects):
        # We search for the actual spaces
        if isinstance(cj_obj, CityJSONSpaceSubclass):
            spaces_ids_to_pos[cj_obj.space_id] = i

    # # Apply the parent-child relationships of unit containers
    # for code, unit_container in all_unit_containers.items():
    #     if code == BuildingUnitContainer.main_parent_code:
    #         CityJSONObject.add_parent_child(
    #             parent=cj_file.city_objects[root_pos],
    #             child=unit_container,
    #         )
    #         continue
    #     parent_code = _unit_code_to_parent(code=code)
    #     # Add the link to its parent
    #     CityJSONObject.add_parent_child(
    #         parent=all_unit_containers[parent_code], child=unit_container
    #     )
    #     # Add the link to its units
    #     for unit in all_units[code]:
    #         CityJSONObject.add_parent_child(parent=unit_container, child=unit)

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

    cj_file.add_cityjson_objects([unit_main_container])
    cj_file.add_cityjson_objects(unit_containers)
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
    for obj_key in tqdm(all_objects_ids, desc="Process all geometries"):
        geom, name = _geom_and_name_from_scene_id(scene=scene, cj_key=obj_key)
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
    for space_id in current_objects:
        last_dot_position = space_id.rfind(".")
        while last_dot_position != -1:
            parent_space_id = space_id[:last_dot_position]
            if parent_space_id not in all_objects_geoms.keys():
                all_objects_geoms[parent_space_id] = []
            last_dot_position = parent_space_id.rfind(".")

    logging.info("Transform into actual CityJSON objects.")

    # Store the geometry into actual objects
    all_objects_cj: dict[str, CityJSONObjectSubclass] = {}
    for space_id, geoms in all_objects_geoms.items():
        hierarchy_level = space_id.count(".")
        if hierarchy_level == 0:
            obj_func = Building
        elif hierarchy_level == 1:
            obj_func = BuildingPart
        elif hierarchy_level == 2:
            obj_func = BuildingStorey
        elif hierarchy_level == 3:
            obj_func = BuildingRoom
        else:
            raise RuntimeError(
                f"Unexpected format for an object space id: '{space_id}'"
            )

        obj_key = obj_func.key_to_cj_key(key=space_id)

        all_objects_cj[space_id] = obj_func(
            cj_key=obj_key, space_id=space_id, geometries=geoms
        )

    # # Add the root group
    # root = BuildingRoot(cj_key=f"Root-08")

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
