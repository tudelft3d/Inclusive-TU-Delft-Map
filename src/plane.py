from __future__ import annotations

import logging
from typing import Tuple

import numpy as np
from numpy.typing import NDArray


def _plane_abcd_from_point_normal(
    point: NDArray[np.float64], normal: NDArray[np.float64]
) -> Tuple[np.float64, np.float64, np.float64, np.float64]:
    """
    Calculate the plane equation from a point and a normal vector.

    Parameters
    ----------
    point : NDArray[np.float64]
        A 3D point of shape (3,).
    normal : NDArray[np.float64]
        A normal vector of shape (3,).

    Returns
    -------
    Tuple[np.float64, np.float64, np.float64, np.float64]
        a, b, c, d corresponding to the plane equation ax + by + cz + d = 0.

    Commments
    ---------
    The normal vector should be normalised.
    """
    d = -np.sum(normal * point)
    return tuple(np.hstack((normal, d)))


# def normal_from_points_old(
#     points: NDArray[np.float64],
# ) -> tuple[NDArray[np.float64], bool]:
#     """
#     Compute the normal of the plane defined by a set of points with PCA.

#     Parameters
#     ----------
#     points : NDArray[np.float64]
#         Set of 3D points (n, 3).

#     Returns
#     -------
#     tuple[NDArray[np.float64], bool]
#         - Normal vector (3,).
#         - Whether the normal is valid (False if the points were collinear for example).

#     Raises
#     ------
#     RuntimeError
#         If the input points are not 3D.
#     """
#     if points.shape[1] != 3:
#         raise RuntimeError("3D points are expected.")

#     # Compute normal as average of normals
#     normal = np.zeros((3,), dtype=np.float64)
#     n_points = points.shape[0]
#     for i in range(n_points):
#         v1 = points[(i + 1) % n_points] - points[i % n_points]
#         v2 = points[(i + 2) % n_points] - points[(i + 1) % n_points]
#         # Calculate the normal vector to the plane
#         normal += np.cross(v1, v2)

#     if np.all(np.isclose(normal, np.zeros_like(normal))):
#         return normal, False
#     else:
#         normal /= np.linalg.norm(normal)
#         return normal, True


def normal_from_points(
    points: NDArray[np.float64],
) -> tuple[NDArray[np.float64], bool]:
    """
    Compute the normal of the plane defined by a set of points with PCA.

    Parameters
    ----------
    points : NDArray[np.float64]
        Set of 3D points (n, 3).

    Returns
    -------
    tuple[NDArray[np.float64], bool]
        - Normal vector (3,).
        - Whether the normal is valid (False if the points were collinear for example).

    Raises
    ------
    RuntimeError
        If the input points are not 3D.
    """
    if points.shape[1] != 3:
        raise RuntimeError("3D points are expected.")
    if points.shape[0] < 3:
        return np.zeros(3), False

    # Center the data
    centroid = points.mean(axis=0)
    centered = points - centroid

    # Compute the SVD of the centered coordinates.
    U, s, Vt = np.linalg.svd(centered, full_matrices=False)

    # The normal is the singular vector associated with the smallest singular value,
    normal = Vt[-1]
    normal /= np.linalg.norm(normal)

    # Check if the points seem to be in the same plane:
    planarity_ratio = (s[0] - s[2]) / s[0]
    linearity_ratio = (s[0] - s[1]) / s[0]
    # valid = planarity_ratio > 0.999 and linearity_ratio < 0.999
    valid = planarity_ratio > 0.999
    if not valid:
        logging.log(logging.DEBUG, "Invalid plane:")
        logging.log(logging.DEBUG, f"{s = }")
        logging.log(logging.DEBUG, f"{planarity_ratio = }")
        logging.log(logging.DEBUG, f"{linearity_ratio = }")
        logging.log(logging.DEBUG, f"{points = }")

    return normal, valid


class Plane3D:

    def __init__(
        self,
        a: np.float64,
        b: np.float64,
        c: np.float64,
        d: np.float64,
        valid: bool = True,
    ) -> None:
        """
        Plane defined by the equation ax + by + cz + d = 0.

        Parameters
        ----------
        a : np.float64
        b : np.float64
        c : np.float64
        d : np.float64
        valid : bool, optional
            Whether the plane is valid and usable. By default True.
        """
        self.a = a
        self.b = b
        self.c = c
        self.d = d
        self.is_valid = valid

        if not self.is_valid:
            return

        self.normal = np.array([a, b, c], dtype=np.float64)

        self._compute_plane_origin()
        self._compute_plane_basis()

    def _compute_plane_origin(self):
        n = np.array([self.a, self.b, self.c], dtype=float)
        denom = np.dot(n, n)
        if denom == 0:
            raise ValueError("Invalid plane coefficients")
        self.origin = -self.d / denom * n

    def _compute_plane_basis(self):
        # Compute two vectors spanning the plane
        arbitrary = np.array([1.0, 0.0, 0.0], dtype=np.float64)
        if np.allclose(arbitrary, np.abs(self.normal)):
            arbitrary = np.array([0.0, 1.0, 0.0], dtype=np.float64)
        u = np.cross(self.normal, arbitrary).astype(np.float64)
        u /= np.linalg.norm(u)
        v = np.cross(self.normal, u).astype(np.float64)

        self.u = u
        self.v = v

    @classmethod
    def from_points(cls, points: NDArray[np.float64]) -> Plane3D:
        """
        Create a plane from an array of points.

        Parameters
        ----------
        points : NDArray[np.float64]
            An array of 3D points of shape (n, 3).

        Returns
        -------
        Plane3D
            Plane that best fits through the points.
        """
        # Compute the normal
        normal, normal_valid = normal_from_points(points)
        # logging.log(logging.DEBUG, f"{normal = }")
        # logging.log(logging.DEBUG, f"{normal_valid = }")

        # Compute the plane parameters
        a, b, c, d = _plane_abcd_from_point_normal(
            point=points.mean(axis=0), normal=normal
        )
        return cls(a=a, b=b, c=c, d=d, valid=normal_valid)

    def project_points(self, points_3D: NDArray[np.float64]) -> NDArray[np.float64]:
        """
        Project the given 3D points onto the plane, giving 2D coordinates.

        Parameters
        ----------
        points_3D : NDArray[np.float64]
            An array of 3D points of shape (n, 3).

        Returns
        -------
        NDArray[np.float64]
            An array of shape (n, 2) with the projected 2D points.

        Raises
        ------
        RuntimeError
            If the plane is invalid.
        """
        if not self.is_valid:
            raise RuntimeError("Cannot use `project_points` with an invalid plane.")
        shifted_points_3D = points_3D - self.origin
        points_projected = np.column_stack(
            (shifted_points_3D @ self.u, shifted_points_3D @ self.v)
        )
        return points_projected

    def unproject_points(self, points_2D: NDArray[np.float64]) -> NDArray[np.float64]:
        """
        Transforms the given 2D points in the plane's coordinate system back into their
        3D coordinates in the main coordinate system.
        This is the inverse of `project_points` ONLY IF the points are actually on the
        plane.
        The output points of this function are all on the plane.

        Parameters
        ----------
        points_2D : NDArray[np.float64]
            An array of shape (n, 2) containing 2D points in the plane's coordinate
            system.

        Returns
        -------
        NDArray[np.float64]
            An array of shape (n, 3) containing the 3D coordinates of the given points
            in the main 3D coordinate system.

        Raises
        ------
        RuntimeError
            If the plane is invalid.
        """
        if not self.is_valid:
            raise RuntimeError("Cannot use `project_points` with an invalid plane.")
        points_unprojected = (
            points_2D[:, 0:1] * self.u + points_2D[:, 1:2] * self.v + self.origin
        )
        return points_unprojected
