"""
Classes to handle the geometry of the CityJSON objects.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Self, Sequence

import numpy as np
from numpy.typing import NDArray
from trimesh import Trimesh


def _remap_boundaries(
    boundaries: list[Any], offset: int, mapping: NDArray[np.signedinteger]
):
    """
    Utility function to re-index the boundaries of the given geometry based on an array mapping old indices to new indices.

    Parameters
    ----------
    boundaries : list[Any]
        Geometry boundaries to re-index.
    offset : int
        Offset of the old indices of `boundaries` in `mapping`.
    mapping : NDArray[np.signedinteger]
        The array mapping old indices to new indices.

    Returns
    -------
    list[Any]
        The geometry boundaries with re-mapped indices.

    Raises
    ------
    RuntimeError
        If the input is not a list or a numpy array.
    """
    new_boundaries = []
    for boundary in boundaries:
        if isinstance(boundary, np.ndarray):
            global_idx = boundary + offset
            new_boundaries.append(mapping[global_idx].astype(np.int64))
        elif isinstance(boundary, list):
            new_boundaries.append(
                _remap_boundaries(boundaries=boundary, offset=offset, mapping=mapping)
            )
        else:
            raise RuntimeError(
                f"Unexpected type {type(boundary)} for a boundary in `_remap_boundaries`"
            )
    return new_boundaries


class Geometry(ABC):
    """
    Base class for a CityJSON geometry object.
    """

    def __init__(
        self,
        lod: int,
        type_str: str,
        vertices: NDArray[np.float64],
        boundaries: list[Any],
    ) -> None:
        """
        Base class for a CityJSON geometry object.

        Parameters
        ----------
        lod : int
            Level of detail.
        type_str : str
            Type of geometry.
        vertices : NDArray[np.float64]
            Array of vertices coordinates.
        boundaries : list[Any]
            Array of indices referencing `vertices` to define the boundaries of the geometry.
        """
        self.lod = lod
        self.type = type_str
        self.vertices = vertices
        self.boundaries = boundaries

    @abstractmethod
    def to_cityjson_format(
        self, replace_boundaries: list[Any] | None
    ) -> dict[str, Any]:
        """
        Export the geometry to the expected CityJSON format.

        Parameters
        ----------
        replace_boundaries : list[Any] | None
            Whether to replace the current boundaries with new boundaries.

        Returns
        -------
        dict[str, Any]
            The CityJSON representation of this geometry.
        """
        raise NotImplementedError()

    @abstractmethod
    def to_trimesh(self) -> Trimesh:
        """
        Export the geometry to a Trimesh

        Returns
        -------
        Trimesh
            A Trimesh corresponding to this geometry.
        """
        raise NotImplementedError()


class MultiSurface(Geometry):

    def __init__(
        self,
        lod: int,
        vertices: NDArray[np.float64],
        boundaries: list[list[NDArray[np.float64]]],
    ) -> None:
        """
        MultiSurface geometry object.

        Parameters
        ----------
        lod : int
            Level of detail.
        vertices : NDArray[np.float64]
            Array of vertices coordinates.
        boundaries : list[list[NDArray[np.float64]]]
            Array of indices referencing `vertices` to define the boundaries of the geometry.
        """

        super().__init__(
            type_str="MultiSurface", lod=lod, vertices=vertices, boundaries=boundaries
        )
        self.boundaries: list[list[NDArray[np.float64]]] = boundaries

    @classmethod
    def from_mesh(cls, lod: int, mesh: Trimesh) -> MultiSurface:
        """
        Generate a MultiSurface from a Trimesh object, and set its lod.

        Parameters
        ----------
        lod : int
            Level of detail.
        mesh : Trimesh
            Trimesh to store as a MultiSurface.

        Returns
        -------
        MultiSurface
            The generated MultiSurface.
        """
        vertices = mesh.vertices.astype(np.float64)
        tri_faces = mesh.faces.astype(np.int64)

        # Format for CityJSON
        surfaces = []
        for face in tri_faces:
            surfaces.append([face])

        return cls(lod=lod, vertices=vertices, boundaries=surfaces)

    def to_cityjson_format(
        self, replace_boundaries: list[list[NDArray[np.float64]]] | None
    ) -> dict[str, Any]:
        """
        Export the geometry to the expected CityJSON format.

        Parameters
        ----------
        replace_boundaries : list[list[NDArray[np.float64]]] | None
            Whether to replace the current boundaries with new boundaries.

        Returns
        -------
        dict[str, Any]
            The CityJSON representation of this geometry.
        """
        boundaries = (
            self.boundaries if replace_boundaries is None else replace_boundaries
        )
        boundaries = [[poly.tolist() for poly in surface] for surface in boundaries]
        return {"type": self.type, "lod": str(self.lod), "boundaries": boundaries}

    def to_trimesh(self) -> Trimesh:
        """
        Export the geometry to a Trimesh

        Returns
        -------
        Trimesh
            A Trimesh corresponding to this geometry.
        """
        tri_faces = []
        for boundary in self.boundaries:
            tri_faces.append(boundary[0])

        return Trimesh(vertices=self.vertices, faces=tri_faces)


class CityJSONGeometries:
    """
    Class to handle a list of geometries and process them together.
    """

    def __init__(self, geometries: Sequence[Geometry]) -> None:
        """
        Create a handle for multiple geometry objects.

        Parameters
        ----------
        geometries : Sequence[Geometry]
            List of Geometry or subclasses to handle.
        """
        self.geometries = list(geometries)
        self.unique_vertices, self.boundaries = self._deduplicate_vertices()

    def get_optimal_translate(self, scale: NDArray[np.float64]) -> NDArray[np.float64]:
        """
        Compute the optimal translation for the list of geometries, computed as the average of all the unique vertices.

        Parameters
        ----------
        scale : NDArray[np.float64]
            Array of shape (3,) containing the scale used to store the vertices.
            Used to round the computed translation.

        Returns
        -------
        NDArray[np.float64]
            Array of shape (3,) containing the computed translation.
        """
        if self.unique_vertices.shape[0] == 0:
            return np.array([0, 0, 0], dtype=np.float64)
        translate = np.mean(self.unique_vertices, axis=0, dtype=np.float64)
        # Apply the scale to have a coherent precision
        translate = np.round(translate / scale) * scale
        assert isinstance(translate, np.ndarray)
        return translate

    def get_geometry_cj(self) -> list[dict[str, Any]]:
        """
        Return all the geometries in CityJSON format, with deduplicated vertices.

        Returns
        -------
        list[dict[str, Any]]
            The list of all geometries
        """
        formatted = []
        for geometry, true_boundaries in zip(self.geometries, self.boundaries):
            formatted.append(
                geometry.to_cityjson_format(replace_boundaries=true_boundaries)
            )
        return formatted

    def get_vertices_cj(
        self, scale: NDArray[np.float64], translate: NDArray[np.float64]
    ) -> list[list[int]]:
        """
        Return all the deduplicated vertices in CityJSON format, scaled and translated according to the given arguments.

        Parameters
        ----------
        scale : NDArray[np.float64]
            Array of shape (3,) containing the scale used to store the vertices.
        translate : NDArray[np.float64]
            Array of shape (3,) containing the translation used to store the vertices.

        Returns
        -------
        list[list[int]]
            List of shape (N, 3) containing all the vertices coordinates.
        """
        vertices = (self.unique_vertices - translate) / scale
        vertices_int64 = np.round(vertices).astype(np.int64)
        vertices_int = list(map(lambda v: list(map(int, v)), vertices_int64.tolist()))
        return vertices_int

    def _deduplicate_vertices(
        self,
    ) -> tuple[NDArray[np.float64], list[Any]]:
        """
        Deduplicate the vertices and recompute the boundaries accordingly.

        Returns
        -------
        unique_vertices: NDArray[np.float64]
            Array of shape (N, 3) with the deduplicated vertices
        new_boundaries: list[Any]
            List of the new boundaries
        """
        # Gather all vertices in the order they appear
        all_vertices: list[NDArray[np.float64]] = []
        offsets: list[int] = []

        last_offset = 0
        for geom in self.geometries:
            offsets.append(last_offset)
            all_vertices.append(geom.vertices)
            last_offset += all_vertices[-1].shape[0]

        # Concatenate into a single array
        if not all_vertices:
            return (np.empty((0, 3), dtype=np.float64), [])

        concat_vertices = np.vstack(all_vertices)

        # Remove duplicate vertices and store the index mapping
        unique_vertices, old_to_new_idx = np.unique(
            concat_vertices, return_inverse=True, axis=0
        )

        # Re‑index each geometry's boundaries
        new_boundaries: list[Any] = []

        for geom, offset in zip(self.geometries, offsets):
            # Translate to the deduplicated index space.
            remapped = _remap_boundaries(
                boundaries=geom.boundaries, offset=offset, mapping=old_to_new_idx
            )
            new_boundaries.append(remapped)

        return unique_vertices, new_boundaries
