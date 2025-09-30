import csv
from collections import defaultdict
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
            id_value = row[id_column]
            if id_value in attributes:
                raise RuntimeError(
                    f"Column {id_column} cannot be they key, because multiple rows share the same value (e.g. {id_value})."
                )
            attributes[id_value] = row
    return attributes


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
        elif hierarchy_level == 1:
            obj_func = BuildingPart
        elif hierarchy_level == 2:
            obj_func = BuildingStorey
        elif hierarchy_level == 3:
            obj_func = BuildingRoom
        else:
            raise RuntimeError(f"Unexpected format for an object name: '{name}'")
        all_objects_cj[name] = obj_func(object_id=name, geometries=geoms)

    # Apply the parent-child relationships
    for obj_cj_id in all_objects_cj.keys():
        last_dot_position = obj_cj_id.rfind(".")
        if last_dot_position != -1:
            obj_parent_id = obj_cj_id[:last_dot_position]
            CityJSONObject.add_parent_child(
                parent=all_objects_cj[obj_parent_id], child=all_objects_cj[obj_cj_id]
            )

    cj_file = CityJSONFile(
        scale=np.array([0.00001, 0.00001, 0.00001], dtype=np.float64),
        translate=np.array([0, 0, 0], dtype=np.float64),
    )
    cj_file.add_cityjson_objects(all_objects_cj.values())

    return cj_file
