"""
Scripts to load CityJSON files.
"""

import json
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from data_pipeline.utils.geometry_utils import merge_trimeshes, triangulate_surface_3d
from numpy.typing import NDArray


def _cj_surface_to_mesh(
    boundaries: list[list[int]],
    vertices: NDArray[np.float64],
) -> trimesh.Trimesh | None:
    """
    Build the Trimesh representation of a CityJSON Surface object.

    Parameters
    ----------
    boundaries : list[list[list[list[int]]]]
        The boundaries of the Surface as represented in CityJSON.
    vertices : NDArray[np.float64]
        The array (N,3) of the vertices coordinates, that the geometry refers to.

    Returns
    -------
    trimesh.Trimesh
        The Trimesh representation of the Surface.
    """
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
    """
    Build the Trimesh representation of a CityJSON MultiSurface object.

    Parameters
    ----------
    boundaries : list[list[list[list[int]]]]
        The boundaries of the MultiSurface as represented in CityJSON.
    vertices : NDArray[np.float64]
        The array (N,3) of the vertices coordinates, that the geometry refers to.

    Returns
    -------
    trimesh.Trimesh
        The Trimesh representation of the MultiSurface.
    """
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
    """
    Build the Trimesh representation of a CityJSON Solid object.

    Parameters
    ----------
    boundaries : list[list[list[list[int]]]]
        The boundaries of the Solid as represented in CityJSON.
    vertices : NDArray[np.float64]
        The array (N,3) of the vertices coordinates, that the geometry refers to.

    Returns
    -------
    trimesh.Trimesh
        The Trimesh representation of the Solid.
    """
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
    """
    Build the Trimesh representation of the geometry, based on a full CityJSON object.
    All the LoDs are created and returned.

    Parameters
    ----------
    obj_dict : dict[str, Any]
        The full CityJSON object as stored in the file.
        In particular, the geometry with potentally multiple LoDs is expected to be stored in "geometry".
    vertices : NDArray[np.float64]
        The array (N,3) of the vertices coordinates, that the geometry refers to.

    Returns
    -------
    dict[str, trimesh.Trimesh] | None
        A dictionary mapping the LoD to its Trimesh representation.

    Raises
    ------
    NotImplementedError
        If the geometry is not one of the supported geometry types.
    """

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
            raise NotImplementedError(f"Unexpected geometry type: '{geom_type}'")
        meshes_lods[lod] = mesh

    return meshes_lods


class CityjsonLoader:
    """
    Utility CityJSON loader that extracts all data from a CityJSON file and transforms the integer coordinates to their real coordinates.
    """

    def __init__(self, cj_path: Path) -> None:
        self.path = cj_path

        self.data = self._cj_load()
        self.vertices = self._cj_extract_vertices()

    def _cj_load(self) -> dict[str, Any]:
        """
        Load the whole file.

        Returns
        -------
        dict[str, Any]
            The CityJSON file directly as a dictionary.
        """
        with open(self.path) as cj_file:
            cj_data = json.load(cj_file)

        return cj_data

    def _cj_extract_vertices(self) -> NDArray[np.float64]:
        """
        Extract and transforms the vertices to their real coordinates.

        Returns
        -------
        NDArray[np.float64]
            The array (N, 3) of vertices coordinates.
        """
        normalised_vertices = np.array(self.data["vertices"], dtype=np.float64)
        translate = np.array(self.data["transform"]["translate"], dtype=np.float64)
        scale = np.array(self.data["transform"]["scale"], dtype=np.float64)
        vertices = scale * normalised_vertices + translate
        return vertices
