import logging

import numpy as np
import trimesh
from numpy.typing import NDArray

from geometry_utils import flatten_trimesh


def height_at_xy(
    mesh: trimesh.Trimesh,
    xy: NDArray[np.float64],
    radii: list[float] = [1, 3, 10, 30, 100],
    z_offset: float = 0.5,
) -> float:
    # Compute distances from every vertex to the XY query point
    verts_xy = mesh.vertices[:, :2]
    dists = np.linalg.norm(verts_xy - xy, axis=1)

    # Keep vertices inside the radius
    for radius in radii:
        mask = dists <= radius
        if np.any(mask):
            return mesh.vertices[mask, 2].max() + z_offset

    raise RuntimeError("No vertex was found in any of the given radii from the point.")


def icon_position_from_mesh(
    mesh: trimesh.Trimesh,
    # xy_margin: float = 0.0,
    # skeleton_res: float = 0.5,
    neighbourhood_radii: list[float] = [1, 3, 10, 30, 100],
    z_offset: float = 0.5,
) -> np.ndarray:

    logging.debug("Start computing icon position...")
    # Flatten the mesh
    flat_mesh = flatten_trimesh(mesh=mesh)

    # Find the centroid
    bounds = flat_mesh.bounds
    xy_center = np.array((bounds[0, :2] + bounds[1, :2]) / 2.0, dtype=np.float64)
    chosen_xy = xy_center

    # Compute a proper Z value
    chosen_z = height_at_xy(
        mesh, chosen_xy, radii=neighbourhood_radii, z_offset=z_offset
    )

    return np.array([chosen_xy[0], chosen_xy[1], chosen_z])
