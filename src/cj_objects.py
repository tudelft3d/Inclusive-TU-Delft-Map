from __future__ import annotations

import json
from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import Any

import networkx as nx
import numpy as np
from numpy.typing import NDArray

from cj_geometry import CityJSONGeometries, Geometry, IconPosition


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
                    f"The number of connected components is {len(comps)} (expected {expected_components})"
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
        self, cj_objects: Sequence[CityJSONObjectSubclass]
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

    def __init__(
        self,
        object_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Sequence[Geometry] | None = None,
        icon_position: IconPosition | None = None,
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
        self.parent_id = None
        self.children_ids: set[str] = set()
        self.geometries = list(geometries if geometries is not None else [])
        if icon_position is not None:
            self.icon_position = icon_position
        elif geometries is not None and len(geometries) > 0:
            # Use the highest lod to create a point
            best_idx = 0
            for idx in range(1, len(geometries)):
                if geometries[idx].lod > geometries[best_idx].lod:
                    best_idx = idx

            self.icon_position = IconPosition.from_mesh(
                geometries[best_idx].to_trimesh()
            )
        else:
            self.icon_position = None
        if self.icon_position is not None:
            self.add_attributes(
                {
                    "icon_position": [
                        self.icon_position.x,
                        self.icon_position.y,
                        self.icon_position.z,
                    ]
                }
            )

    def __repr__(self) -> str:
        return f"{type(self)}(id={self.id}, parent_id={self.parent_id}, children_ids={self.children_ids})"

    def _set_parent(self, parent_id: str, replace: bool = False) -> None:
        if self.parent_id is not None and not replace:
            raise RuntimeError(
                "Parent id is already set. To replace it, set `replace` to True."
            )
        self.parent_id = parent_id

    def _add_child(self, child_id: str) -> None:
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
        cls, parent: CityJSONObjectSubclass, child: CityJSONObjectSubclass
    ) -> None:
        parent._add_child(child.id)
        child._set_parent(parent.id)

    @classmethod
    def add_unit_space(cls, unit: BuildingUnit, space: CityJSONSpace) -> None:
        unit._add_space(space.id)
        space._add_unit(unit.id)


class CityJSONSpace(CityJSONObject):

    type_name = "CityJSONSpace"

    def __init__(
        self,
        object_id: str,
        space_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Sequence[Geometry] | None = None,
    ) -> None:

        super().__init__(
            object_id=object_id,
            attributes=attributes,
            geometries=geometries,
        )
        self.space_id = space_id
        self.add_attributes({"space_id": space_id})
        self.parent_units: set[str] = set()

    def _add_unit(self, new_unit_id: str) -> None:
        self.parent_units.add(new_unit_id)

    def get_cityobject(self) -> dict[str, Any]:
        parent_units_key = "parent_units"
        self.add_attributes({parent_units_key: self.parent_units})
        content_dict = super().get_cityobject()
        # Remove it from the attributes to ensure the object is unchanged
        self.attributes.pop(parent_units_key)
        return content_dict

    @classmethod
    def space_number_to_prefix(cls, number: str) -> str:
        return f"Building_{number.split(".")[0]}"

    @classmethod
    def space_number_to_id(cls, number: str) -> str:
        prefix = cls.space_number_to_prefix(number=number)
        number.replace(".", ":")
        number.replace("-", "_")
        return f"{prefix}-{cls.type_name}-{number}"


class Building(CityJSONSpace):

    type_name = "Building"

    def __init__(
        self,
        object_id: str,
        space_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Sequence[Geometry] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            space_id=space_id,
            attributes=attributes,
            geometries=geometries,
        )


class BuildingPart(CityJSONSpace):

    type_name = "BuildingPart"

    def __init__(
        self,
        object_id: str,
        space_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Sequence[Geometry] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            space_id=space_id,
            attributes=attributes,
            geometries=geometries,
        )


class BuildingStorey(CityJSONSpace):

    type_name = "BuildingStorey"

    def __init__(
        self,
        object_id: str,
        space_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Sequence[Geometry] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            space_id=space_id,
            attributes=attributes,
            geometries=geometries,
        )


class BuildingRoom(CityJSONSpace):

    type_name = "BuildingRoom"

    def __init__(
        self,
        object_id: str,
        space_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Sequence[Geometry] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            space_id=space_id,
            attributes=attributes,
            geometries=geometries,
        )


class BuildingUnitContainer(CityJSONObject):

    type_name = "CityObjectGroup"
    main_parent = "BuildingUnits"

    def __init__(
        self,
        object_id: str,
        unit_code: str,
        attributes: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            attributes=attributes,
            geometries=None,
        )
        self.unit_code = unit_code
        self.add_attributes({"code": unit_code})

    @classmethod
    def unit_code_to_id(cls, code: str, prefix: str) -> str:
        code.replace(".", ":")
        code.replace("-", "_")
        prefix.replace("-", "_")
        return f"{prefix}-{cls.type_name}-{code}"


class BuildingUnit(BuildingUnitContainer):

    type_name = "BuildingUnit"

    def __init__(
        self,
        object_id: str,
        unit_code: str,
        attributes: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            unit_code=unit_code,
            attributes=attributes,
        )
        self.unit_spaces: set[str] = set()

    def _add_space(self, new_space_id: str) -> None:
        self.unit_spaces.add(new_space_id)

    def get_cityobject(self) -> dict[str, Any]:
        unit_spaces_key = "unit_spaces"
        self.add_attributes({unit_spaces_key: self.unit_spaces})
        content_dict = super().get_cityobject()
        # Remove it from the attributes to ensure the object is unchanged
        self.attributes.pop(unit_spaces_key)
        return content_dict

    @classmethod
    def unit_code_to_id(cls, code: str, prefix: str, number: int) -> str:
        code.replace(".", ":")
        code.replace("-", "_")
        prefix.replace("-", "_")
        return f"{prefix}-{cls.type_name}-{code}@{str(number)}"


class BuildingRoot(CityJSONObject):

    type_name = "CityObjectGroup"

    def __init__(
        self,
        object_id: str,
        attributes: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            object_id=object_id,
            attributes=attributes,
            geometries=None,
        )


CityJSONSpaceSubclass = Building | BuildingPart | BuildingStorey | BuildingRoom
CityJSONObjectSubclass = (
    CityJSONSpaceSubclass | BuildingUnit | BuildingUnitContainer | BuildingRoot
)
