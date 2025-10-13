from abc import ABC, abstractmethod
from typing import Any, Self

import numpy as np
from numpy.typing import NDArray
from trimesh import Trimesh

from geometry_utils import flatten_trimesh
from icon_positions import icon_position_from_mesh


def _remap_boundaries(
    boundaries: list[Any], offset: int, mapping: NDArray[np.signedinteger]
):
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

    def __init__(
        self,
        lod: int,
        type_str: str,
        vertices: NDArray[np.float64],
        boundaries: list[Any],
    ) -> None:
        self.lod = lod
        self.type = type_str
        self.vertices = vertices
        self.boundaries = boundaries

    @abstractmethod
    def to_cityjson_format(
        self, replace_boundaries: list[Any] | None
    ) -> dict[str, Any]:
        raise NotImplementedError()

    @abstractmethod
    def to_trimesh(self) -> Trimesh:
        raise NotImplementedError()


class MultiPoint(Geometry):

    def __init__(
        self, lod: int, vertices: NDArray[np.float64], boundaries: list[Any]
    ) -> None:
        super().__init__(
            type_str="MultiPoint", lod=lod, vertices=vertices, boundaries=boundaries
        )


class MultiSurface(Geometry):

    def __init__(
        self, lod: int, vertices: NDArray[np.float64], boundaries: list[Any]
    ) -> None:
        super().__init__(
            type_str="MultiSurface", lod=lod, vertices=vertices, boundaries=boundaries
        )

    @classmethod
    def from_mesh(cls, lod: int, mesh: Trimesh) -> Self:
        vertices = mesh.vertices.astype(np.float64)
        tri_faces = mesh.faces.astype(np.int64)

        # Format for CityJSON
        surfaces = []
        for face in tri_faces:
            surfaces.append([face])

        return cls(lod=lod, vertices=vertices, boundaries=surfaces)

    def to_cityjson_format(
        self, replace_boundaries: list[list[NDArray[np.int64]]] | None
    ) -> dict[str, Any]:
        boundaries = (
            self.boundaries if replace_boundaries is None else replace_boundaries
        )
        boundaries = [[poly.tolist() for poly in surface] for surface in boundaries]
        return {"type": "MultiSurface", "lod": str(self.lod), "boundaries": boundaries}

    def to_trimesh(self) -> Trimesh:
        tri_faces = []
        for boundary in self.boundaries:
            tri_faces.append(boundary[0])

        return Trimesh(vertices=self.vertices, faces=tri_faces)


class CityJSONGeometries:

    def __init__(self, geometries: list[Geometry]) -> None:
        self.geometries = geometries
        self.unique_vertices, self.boundaries = self._deduplicate_vertices()

    def get_optimal_translate(self, scale: NDArray[np.float64]) -> NDArray[np.float64]:
        translate = np.mean(self.unique_vertices, axis=0, dtype=np.float64)
        # Apply the scale to have a coherent precision
        translate = np.round(translate / scale) * scale
        assert isinstance(translate, np.ndarray)
        return translate

    def get_geometry_cj(self) -> list[dict[str, Any]]:
        formatted = []
        for geometry, true_boundaries in zip(self.geometries, self.boundaries):
            formatted.append(
                geometry.to_cityjson_format(replace_boundaries=true_boundaries)
            )
        return formatted

    def get_vertices_cj(
        self, scale: NDArray[np.float64], translate: NDArray[np.float64]
    ) -> list[list[float]]:
        vertices = (self.unique_vertices - translate) / scale
        vertices_int = np.round(vertices).astype(np.int64)
        return vertices_int.tolist()

    def _deduplicate_vertices(
        self,
    ) -> tuple[NDArray[np.float64], list[Any]]:
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


class IconPosition:

    def __init__(self, x: float, y: float, z: float) -> None:
        self.x = x
        self.y = y
        self.z = z

    @classmethod
    def from_mesh(cls, mesh: Trimesh) -> Self:
        if not isinstance(mesh, Trimesh):
            raise TypeError(
                f"IconPosition.from_geometry expects a `MultiSurface` instance, not `{type(geom)}`."
            )

        pos_array = icon_position_from_mesh(mesh=mesh, z_offset=2)
        return cls(x=pos_array[0], y=pos_array[1], z=pos_array[2])
