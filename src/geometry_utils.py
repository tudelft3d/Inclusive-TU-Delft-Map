from __future__ import annotations

import logging
from typing import Tuple

import numpy as np
import shapely
import shapely.geometry as sg
import triangle as tri
import trimesh
from numpy.typing import NDArray
from shapely import LineString, MultiPolygon, Polygon
from trimesh.path import Path2D

from plane import Plane3D

# def compute_flat_geometry(geometry: sg.MultiPolygon) -> sg.MultiPolygon:
#     geometry_2D = force_2d(geometry)
#     flat_geometry = unary_union(geometry_2D)
#     if not isinstance(flat_geometry, sg.MultiPolygon):
#         if isinstance(flat_geometry, sg.Polygon):
#             flat_geometry = sg.MultiPolygon([flat_geometry])
#         else:
#             raise RuntimeError(
#                 f"The flat_geometry is of type {flat_geometry.geom_type} after union."
#             )
#     return flat_geometry


def flatten_trimesh(
    mesh: trimesh.Trimesh, z_value: np.float64 | None = None
) -> trimesh.Trimesh:
    try:
        z_value = np.min(mesh.vertices[:, 2]) if z_value is None else z_value
        flatten_path_2D: Path2D = mesh.projected(normal=(0, 0, 1))
        vertices, faces = flatten_path_2D.triangulate(**{"engine": "triangle"})
        flat_mesh = trimesh.Trimesh(vertices=vertices, faces=faces)
        flat_mesh.vertices = np.hstack(
            (flat_mesh.vertices, np.full((flat_mesh.vertices.shape[0], 1), z_value))
        )
        orient_polygons_z_up(flat_mesh)
        return flat_mesh
    except Exception as e:
        raise e


# def compute_oriented_bbox(multipoly: sg.MultiPolygon) -> sg.MultiPolygon:
#     bbox = multipoly.oriented_envelope
#     if not isinstance(bbox, sg.Polygon):
#         raise RuntimeError("The initial envelope is assumed to be a Polygon")
#     z_values = [pt[2] for poly in multipoly.geoms for pt in poly.exterior.coords]
#     z_min = min(z_values)
#     z_max = max(z_values)
#     bbox_polygons: list[sg.Polygon] = []

#     # Add the side polygons
#     for i in range(len(bbox.exterior.coords) - 1):
#         pt0 = bbox.exterior.coords[i]
#         pt1 = bbox.exterior.coords[i + 1]
#         x0, y0 = pt0
#         x1, y1 = pt1
#         bbox_polygons.append(
#             sg.Polygon(
#                 [
#                     [x0, y0, z_min],
#                     [x0, y0, z_max],
#                     [x1, y1, z_max],
#                     [x1, y1, z_min],
#                     [x0, y0, z_min],
#                 ]
#             )
#         )

#     # Add the bottom polygon
#     bbox_polygons.append(sg.Polygon([[x, y, z_min] for (x, y) in bbox.exterior.coords]))

#     # Add the top polygon
#     bbox_polygons.append(
#         sg.Polygon([[x, y, z_max] for (x, y) in bbox.exterior.coords[::-1]])
#     )

#     bbox_3d = sg.MultiPolygon(bbox_polygons)

#     if not isinstance(bbox_3d, sg.MultiPolygon):
#         if isinstance(bbox_3d, sg.Polygon):
#             bbox_3d = sg.MultiPolygon([bbox_3d])
#         else:
#             raise RuntimeError(f"The bbox should be a MultiPolygon.")

#     return bbox_3d


def orient_polygons_z_up(mesh: trimesh.Trimesh) -> None:
    faces = mesh.faces.copy()
    for i, normal in enumerate(mesh.face_normals):
        # Check if the face is actually in the x,y plane
        if not np.all(np.abs(normal[:2]) < 1e-3):
            raise RuntimeError(
                f"A value is larger than expected in absolute value: {np.max(np.abs(normal[:2]))}"
            )

        if normal[2] < 0:
            faces[i, 1], faces[i, 2] = faces[i, 2], faces[i, 1]

    mesh.faces = faces


def merge_trimeshes(
    meshes: list[trimesh.Trimesh], fix_geometry: bool
) -> trimesh.Trimesh:
    full_mesh = trimesh.util.concatenate(meshes)
    if not isinstance(full_mesh, trimesh.Trimesh):
        raise RuntimeError("The combination of the meshes isn't a Trimesh.")
    if full_mesh.is_empty:
        logging.log(logging.DEBUG, "Empty!")
        return full_mesh
    if fix_geometry:
        full_mesh.process(validate=True)
        full_mesh.update_faces(full_mesh.unique_faces())
        full_mesh.fix_normals()
        full_mesh.fill_holes()
    else:
        full_mesh.process()
    return full_mesh


# def cleanup_vertices(
#     boundaries: list[NDArray[np.int64]],
#     vertices: NDArray[np.float64],
# ):
#     # Select only the used vertices
#     used_ids = np.unique(np.concatenate(boundaries))
#     old_to_new = -np.ones(vertices.shape[0], dtype=np.int64)
#     old_to_new[used_ids] = np.arange(len(used_ids))
#     vertices = vertices[used_ids]
#     boundaries = [old_to_new[boundary] for boundary in boundaries]

#     # Remove the duplicate vertices
#     tol = 1e-6
#     scale = 1.0 / tol
#     rounded = np.round(vertices * scale).astype(np.int64)

#     # Use a structured array so np.unique can work on rows efficiently
#     dtype = np.dtype([("x", np.int64), ("y", np.int64), ("z", np.int64)])
#     structured = rounded.view(dtype).reshape(-1)

#     _, uniq_idx, inv_map = np.unique(structured, return_index=True, return_inverse=True)

#     vertices = vertices[uniq_idx]
#     boundaries = [inv_map[boundary] for boundary in boundaries]

#     return boundaries, vertices


def fix_polygon_2d(polygon: Polygon) -> list[Polygon]:
    polygon = shapely.remove_repeated_points(polygon)
    if not shapely.is_valid(polygon):
        valid_geometry = shapely.make_valid(polygon, method="structure")
    else:
        valid_geometry = polygon
    if isinstance(valid_geometry, MultiPolygon):
        return list(valid_geometry.geoms)
    elif isinstance(valid_geometry, Polygon):
        return [valid_geometry]
    elif isinstance(valid_geometry, LineString):
        # if valid_geometry.is_closed:
        #     return [Polygon(shell=valid_geometry)]
        # else:
        #     return []
        return []
    else:
        raise RuntimeError(
            f"Unexpected output after making the polygon valid: {valid_geometry}"
        )


def triangulate_linear_ring_2d(
    lring_2d: sg.LinearRing,
    holes_lrings_2d: list[sg.LinearRing] | None = None,
) -> Tuple[NDArray[np.float64], NDArray[np.int64]]:
    # Check that the holes inputs are correct
    if holes_lrings_2d is None:
        holes_lrings_2d = []

    # Prepare the triangulation
    points_2d = np.array(lring_2d.coords[:-1], dtype=np.float64)[::-1]
    ring_segments = [(i, (i + 1) % len(points_2d)) for i in range(len(points_2d))]

    for hole_lring in holes_lrings_2d:
        offset = points_2d.shape[0]
        hole_points_2d = np.array(hole_lring.coords[:-1], dtype=np.float64)[::-1]
        ring_segments.extend(
            [
                (offset + i, offset + (i + 1) % len(hole_points_2d))
                for i in range(len(hole_points_2d))
            ]
        )
        points_2d = np.concat((points_2d, hole_points_2d))

    # Remove duplicate vertices
    tol = 1e-6
    scale = 1.0 / tol
    rounded = np.round(points_2d * scale).astype(np.int64)

    # Use a structured array so np.unique can work on rows efficiently
    dtype = np.dtype([("x", np.int64), ("y", np.int64)])
    structured = rounded.view(dtype).reshape(-1)

    _, uniq_idx, inv_map = np.unique(structured, return_index=True, return_inverse=True)

    previous_len = points_2d.shape[0]
    points_2d = points_2d[uniq_idx]
    if points_2d.shape[0] != previous_len:
        logging.log(logging.DEBUG, f"{previous_len} -> {points_2d.shape[0]}")
    ring_segments = [inv_map[np.array(segment)] for segment in ring_segments]

    triangulation_input = {"vertices": points_2d, "segments": ring_segments}
    # logging.log(logging.DEBUG, triangulation_input)
    polygon_2d = sg.Polygon(lring_2d, holes=holes_lrings_2d)
    # logging.log(logging.DEBUG, polygon_2d)

    try:
        triangulation = tri.triangulate(triangulation_input, "p")
    except Exception as e:
        logging.log(logging.DEBUG, "Houston we have a problem...")
        raise e
    if "triangles" not in triangulation:
        logging.log(logging.DEBUG, "No triangle!")
        # logging.log(logging.DEBUG, f"{np.array(lring_2d.coords) = }")
        # logging.log(logging.DEBUG, f"{holes_lrings_2d = }")
        return np.empty((0, 2), dtype=np.float64), np.empty((0, 3), dtype=np.int64)
    vertices = np.array(triangulation["vertices"], dtype=np.float64)
    triangles = np.array(triangulation["triangles"], dtype=np.int64)

    # Remove triangles that are outside the polygon (especially holes)
    triangles_to_keep = []
    polygon_2d = sg.Polygon(lring_2d, holes=holes_lrings_2d)
    for i, triangle in enumerate(triangles):
        # Check if the centroid of the triangle is in the polygon
        v0, v1, v2 = vertices[triangle]
        centroid = sg.Point((v0 + v1 + v2) / 3)
        if polygon_2d.contains(centroid):
            triangles_to_keep.append(i)

    triangles = triangles[triangles_to_keep]

    return vertices, triangles


def triangulate_polygon_2d(
    polygon: Polygon,
) -> Tuple[NDArray[np.float64], NDArray[np.int64], bool]:
    # Return nothing if the ring doesn't have enough points to compute a normal
    all_points = list(polygon.exterior.coords[:-1])
    for interior in polygon.interiors:
        all_points.extend(interior.coords[:-1])
    unique_points = np.unique(np.concat(all_points), axis=0)
    if unique_points.shape[0] < 3:
        return (
            np.zeros((0, 2), dtype=np.float64),
            np.zeros((0, 2), dtype=np.int64),
            False,
        )

    # Triangulate the polygon
    holes_lrings_2d = list(polygon.interiors)
    tri_vertices, tri_faces = triangulate_linear_ring_2d(
        polygon.exterior,
        holes_lrings_2d=holes_lrings_2d,
    )

    return tri_vertices, tri_faces, True


def triangulate_surface_3d(
    outer_boundary: NDArray[np.int64],
    holes: list[NDArray[np.int64]],
    vertices: NDArray[np.float64],
) -> Tuple[NDArray[np.float64], NDArray[np.int64], bool]:
    # Do nothing if the object is already a triangle
    if outer_boundary.shape == 3 and len(holes) == 0:
        tri_vertices = vertices[outer_boundary]
        tri_faces = np.array([0, 1, 2]).reshape(1, 3)
        return tri_vertices, tri_faces, True

    # Compute the plane of the surface
    used_ids = np.unique(np.concatenate([outer_boundary] + holes))
    unique_points = np.unique(vertices[used_ids], axis=0)
    plane = Plane3D.from_points(unique_points)
    if not plane.is_valid:
        logging.log(logging.DEBUG, "Invalid plane!")
        return (
            np.zeros((0, 3), dtype=np.float64),
            np.zeros((0, 3), dtype=np.int64),
            False,
        )

    # Compute the 2D points
    outer_boundary_2d = plane.project_points(vertices[outer_boundary])
    holes_2d = [plane.project_points(vertices[hole]) for hole in holes]

    # Create the polygon (repeat the first point for the rings)
    exterior = np.vstack((outer_boundary_2d, outer_boundary_2d[:1]))
    interiors = [np.vstack((hole_2d, hole_2d[:1])) for hole_2d in holes_2d]
    poly = Polygon(shell=exterior, holes=interiors)

    # Fix the polygon in case of problems
    polys = fix_polygon_2d(polygon=poly)

    # Triangulate all the polygons
    tri_vertices_2d_all = np.empty((0, 2), dtype=np.float64)
    tri_faces_all = np.empty((0, 3), dtype=np.int64)
    worked_all = []
    for poly in polys:
        tri_vertices, tri_faces, worked = triangulate_polygon_2d(poly)
        tri_faces_all = np.vstack(
            (tri_faces_all, tri_faces + tri_vertices_2d_all.shape[0])
        )
        tri_vertices_2d_all = np.vstack((tri_vertices_2d_all, tri_vertices))
        worked_all.append(worked)
    worked = any(worked_all)

    # Unproject the points
    tri_vertices_all = plane.unproject_points(tri_vertices_2d_all)

    return tri_vertices_all, tri_faces_all, worked
