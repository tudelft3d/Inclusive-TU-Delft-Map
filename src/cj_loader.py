import json
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from numpy.typing import NDArray

from geometry_utils import merge_trimeshes, triangulate_surface_3d


def _cj_surface_to_mesh(
    boundaries: list[list[int]],
    vertices: NDArray[np.float64],
) -> trimesh.Trimesh | None:
    if len(boundaries) == 1 and len(boundaries[0]) == 3:
        tri_vertices = vertices[boundaries[0]]
        tri_faces = np.array([0, 1, 2]).reshape(1, 3)
        return trimesh.Trimesh(vertices=tri_vertices, faces=tri_faces)

    outer_boundary = np.array(boundaries[0], dtype=np.int64)
    holes = [np.array(boundary, dtype=np.int64) for boundary in boundaries[1:]]
    tri_vertices, tri_faces, worked = triangulate_surface_3d(
        outer_boundary=outer_boundary, holes=holes, vertices=vertices
    )
    if not worked:
        return None
    else:
        return trimesh.Trimesh(vertices=tri_vertices, faces=tri_faces)


def _cj_multisurface_to_mesh(
    boundaries: list[list[list[int]]],
    vertices: NDArray[np.float64],
) -> trimesh.Trimesh:
    surfaces_meshes: list[trimesh.Trimesh] = []
    for surface in boundaries:
        mesh = _cj_surface_to_mesh(
            boundaries=surface,
            vertices=vertices,
        )
        if mesh is not None:
            surfaces_meshes.append(mesh)

    # Merge all the meshes
    return merge_trimeshes(surfaces_meshes, fix_geometry=True)


def _cj_solid_to_mesh(
    boundaries: list[list[list[list[int]]]],
    vertices: NDArray[np.float64],
) -> trimesh.Trimesh:
    solids_meshes: list[trimesh.Trimesh] = []
    for solid in boundaries:
        mesh = _cj_multisurface_to_mesh(boundaries=solid, vertices=vertices)
        if mesh is not None:
            solids_meshes.append(mesh)

    # Merge all the meshes
    return merge_trimeshes(solids_meshes, fix_geometry=True)


def cj_object_to_mesh(
    obj_dict: dict[str, Any], vertices: NDArray[np.float64]
) -> dict[str, trimesh.Trimesh] | None:

    # Return None if there is no geometry
    if "geometry" not in obj_dict or len(obj_dict["geometry"]) == 0:
        return None

    # CityObjects may contain several geometry entries (different LoDs)
    meshes_lods = {}
    for geom in obj_dict["geometry"]:
        lod = geom["lod"]
        geom_type = geom["type"]
        boundaries = geom["boundaries"]
        if geom_type == "MultiSurface":
            mesh = _cj_multisurface_to_mesh(
                boundaries=boundaries,
                vertices=vertices,
            )
        elif geom_type == "Solid":
            mesh = _cj_solid_to_mesh(
                boundaries=boundaries,
                vertices=vertices,
            )
        else:
            raise RuntimeError(f"Unexpected geometry type: '{geom_type}'")
        meshes_lods[lod] = mesh

    return meshes_lods


class CityjsonLoader:

    def __init__(self, cj_path: Path) -> None:
        self.path = cj_path

        self.data = self._cj_load()
        self.vertices = self._cj_extract_vertices()

    def _cj_load(self) -> dict[str, Any]:
        with open(self.path) as cj_file:
            cj_data = json.load(cj_file)

        return cj_data

    def _cj_extract_vertices(self) -> NDArray[np.float64]:
        normalised_vertices = np.array(self.data["vertices"], dtype=np.float64)
        translate = np.array(self.data["transform"]["translate"], dtype=np.float64)
        scale = np.array(self.data["transform"]["scale"], dtype=np.float64)
        vertices = scale * normalised_vertices + translate
        return vertices
