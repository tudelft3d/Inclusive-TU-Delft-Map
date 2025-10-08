import json
from abc import ABC, abstractmethod
from collections.abc import Iterable
from typing import Any

import networkx as nx
import numpy as np
from numpy.typing import NDArray

from cj_geometry import CityJSONGeometries, Geometry

type CityJSONObjectSubclass = Building | BuildingPart | BuildingStorey | BuildingRoom | BuildingUnit | BuildingUnitContainer


class CityJSONFile:

    def __init__(
        self, scale: NDArray[np.float64], translate: NDArray[np.float64] | None
    ) -> None:
        self.city_objects: list[CityJSONObjectSubclass] = []

        # Transform
        scale_shape = (3,)
        if scale.shape != scale_shape:
            raise RuntimeError(
                f"The given scale has shape {scale.shape} instead of {scale_shape}."
            )
        translate_shape = (3,)
        if translate is not None and translate.shape != translate_shape:
            raise RuntimeError(
                f"The given translate has shape {translate.shape} instead of {translate_shape}."
            )

        self.scale = scale
        self.translate = translate

    def check_objects_hierarchy(self, n_components: int | None = None) -> None:
        G = nx.DiGraph()

        # First add every node
        for obj in self.city_objects:
            G.add_node(obj.id)

        # Then add directed edges parent -> child
        for obj in self.city_objects:
            for child_id in obj.children_ids:
                G.add_edge(obj.id, child_id)

        # Look for missing nodes
        missing = set(G.edges()) - {
            (u, v) for u, v in G.edges() if G.has_node(u) and G.has_node(v)
        }
        if missing:
            raise RuntimeError(f"Edges reference unknown nodes: {missing}")

        # Cycle detection
        if not nx.is_directed_acyclic_graph(G):
            cycles = list(nx.simple_cycles(G))
            raise RuntimeError(f"Cycle(s) detected - e.g. {cycles[:1][0]}")

        # Connectivity (ignore direction)
        if not nx.is_weakly_connected(G):
            # Find the separate components for a nicer error message
            comps = list(nx.weakly_connected_components(G))
            # The number of expected components should be the number of buildings
            if n_components is None:
                expected_components = sum(
                    map(
                        lambda obj: isinstance(obj, Building),
                        self.city_objects,
                    )
                )
            else:
                expected_components = n_components
            if len(comps) != expected_components:
                raise RuntimeError(
                    f"The number of connected components is {len(comps)} (expected {n_components})"
                )

        # Ensure every edge is mirrored in the opposite list
        for obj in self.city_objects:
            if obj.parent_id is not None:
                G.add_edge(obj.id, obj.parent_id)

        for u, v, d in G.edges(data=True):
            if not G.has_edge(v, u):
                raise RuntimeError(
                    f"The edge between {u} and {v} doesn't go both ways."
                )

    def to_json(self) -> str:
        full_object = {}
        full_object["type"] = "CityJSON"
        full_object["version"] = "2.0"
        full_object["metadata"] = {
            "referenceSystem": "https://www.opengis.net/def/crs/EPSG/0/7415"
        }

        # Check objectw with and without the geometry
        geometries_indices: list[list[int] | None] = []
        next_index = 0
        unprocessed_geoms = []
        for obj in self.city_objects:
            if len(obj.geometries) == 0:
                geometries_indices.append(None)
            else:
                indices = []
                for geometry in obj.geometries:
                    unprocessed_geoms.append(geometry)
                    indices.append(next_index)
                    next_index += 1
                geometries_indices.append(indices)

        # Process the geometry
        geoms_formatter = CityJSONGeometries(unprocessed_geoms)
        self.translate = geoms_formatter.get_optimal_translate(scale=self.scale)
        list_dict_geoms = geoms_formatter.get_geometry_cj()
        vertices = geoms_formatter.get_vertices_cj(
            scale=self.scale, translate=self.translate
        )

        # Write the CityObjects
        cityobjects = {}
        for obj, geom_indices in zip(self.city_objects, geometries_indices):
            cityobject = obj.get_cityobject()
            if geom_indices is not None:
                cityobject["geometry"] = [list_dict_geoms[idx] for idx in geom_indices]
            cityobjects[obj.id] = cityobject
        full_object["CityObjects"] = cityobjects

        # Write the transform
        full_object["transform"] = {
            "scale": self.scale.tolist(),
            "translate": self.translate.tolist(),
        }

        full_object["vertices"] = vertices

        return json.dumps(full_object)

    def add_cityjson_objects(
        self, cj_objects: Iterable[CityJSONObjectSubclass]
    ) -> None:
        self.city_objects.extend(cj_objects)

    def get_root_position(self) -> int:
        roots_ids: list[int] = []
        for i, cj_obj in enumerate(self.city_objects):
            if cj_obj.parent_id == None:
                roots_ids.append(i)
        if len(roots_ids) != 1:
            raise RuntimeError(
                f"The current CityJSONFile instancce has {len(roots_ids)} roots, but 1 was expected."
            )
        return roots_ids[0]


class CityJSONObject(ABC):

    type_name = "CityJSONObject"
    space_id = "space_id"
    unit_code = "code"

    def __init__(
        self,
        object_id: str,
        attributes: dict[str, Any] | None = None,
        parent_id: str | None = None,
        children_ids: list[str] | None = None,
        geometries: Iterable[Geometry] | None = None,
    ) -> None:
        if attributes is not None:
            if not isinstance(attributes, dict):
                raise RuntimeError(
                    f"The attributes of a CityJSONObject should be a dictionary."
                )
            for key in attributes.keys():
                if not isinstance(key, str):
                    raise RuntimeError(
                        f"The attributes of a CityJSONObject should have strings as keys."
                    )

        self.id = object_id
        self.attributes = attributes if attributes is not None else {}
        self.parent_id = parent_id
        self.children_ids = set(children_ids if children_ids is not None else [])
        self.geometries = list(geometries if geometries is not None else [])

    def __repr__(self) -> str:
        return f"{type(self)}(id={self.id}, parent_id={self.parent_id}, children_ids={self.children_ids})"

    def set_parent(self, parent_id: str, replace: bool = False) -> None:
        if self.parent_id is not None and not replace:
            raise RuntimeError(
                "Parent id is already set. To replace it, set `replace` to True."
            )
        self.parent_id = parent_id

    def add_child(self, child_id: str) -> None:
        self.children_ids.add(child_id)

    def get_cityobject(self) -> dict[str, Any]:
        content_dict = {}
        content_dict["type"] = type(self).type_name
        if self.parent_id is not None:
            content_dict["parents"] = [self.parent_id]
        if len(self.children_ids) > 0:
            content_dict["children"] = list(self.children_ids)
        content_dict["attributes"] = self.attributes
        return content_dict

    def add_attributes(
        self, new_attributes: dict[str, Any], overwrite: bool = False
    ) -> None:
        for key, value in new_attributes.items():
            if key in self.attributes and not overwrite:
                raise RuntimeError(
                    f"The key '{key}' is already in the attributes. Set `overwrite` to True to overwrite."
                )
            self.attributes[key] = value

    @classmethod
    def add_parent_child(
        cls: type, parent: CityJSONObjectSubclass, child: CityJSONObjectSubclass
    ) -> None:
        parent.add_child(child.id)
        child.set_parent(parent.id)


class Building(CityJSONObject):

    type_name = "Building"

    def __init__(
        self,
        object_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Iterable[Geometry] | None = None,
        parent_id: str | None = None,
        children_ids: list[str] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            attributes=attributes,
            parent_id=parent_id,
            children_ids=children_ids,
            geometries=geometries,
        )


class BuildingPart(CityJSONObject):

    type_name = "BuildingPart"

    def __init__(
        self,
        object_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Iterable[Geometry] | None = None,
        parent_id: str | None = None,
        children_ids: list[str] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            attributes=attributes,
            parent_id=parent_id,
            children_ids=children_ids,
            geometries=geometries,
        )


class BuildingStorey(CityJSONObject):

    type_name = "BuildingStorey"

    def __init__(
        self,
        object_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Iterable[Geometry] | None = None,
        parent_id: str | None = None,
        children_ids: list[str] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            attributes=attributes,
            parent_id=parent_id,
            children_ids=children_ids,
            geometries=geometries,
        )


class BuildingRoom(CityJSONObject):

    type_name = "BuildingRoom"

    def __init__(
        self,
        object_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Iterable[Geometry] | None = None,
        parent_id: str | None = None,
        children_ids: list[str] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            attributes=attributes,
            parent_id=parent_id,
            children_ids=children_ids,
            geometries=geometries,
        )


class BuildingUnit(CityJSONObject):

    type_name = "BuildingUnit"
    unit_children = "unit_spaces"
    space_parents = "parent_units"

    def __init__(
        self,
        object_id: str,
        attributes: dict[str, Any] | None = None,
        parent_id: str | None = None,
        children_ids: list[str] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            attributes=attributes,
            parent_id=parent_id,
            children_ids=children_ids,
            geometries=None,
        )


class BuildingUnitContainer(CityJSONObject):

    type_name = "BuildingUnitContainer"
    main_parent = "BuildingUnits"

    def __init__(
        self,
        object_id: str,
        attributes: dict[str, Any] | None = None,
        parent_id: str | None = None,
        children_ids: list[str] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            attributes=attributes,
            parent_id=parent_id,
            children_ids=children_ids,
            geometries=None,
        )
