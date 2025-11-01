from __future__ import annotations

import json
from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import Any

import networkx as nx
import numpy as np
from numpy.typing import NDArray

from cj_attributes import (
    ARGUMENT_TO_NAME,
    Attr,
    BdgAttr,
    BdgPartAttr,
    BdgRoomAttr,
    BdgStoreyAttr,
    BdgUnitAttr,
)
from cj_geometry import CityJSONGeometries, Geometry
from icon_positions import IconPosition


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
    icon_z_offset = 2

    def __init__(
        self,
        cj_key: str,
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

        self.id = cj_key
        self.attributes = attributes if attributes is not None else {}
        self.parent_id = None
        self.children_ids: set[str] = set()
        self.geometries = list(geometries if geometries is not None else [])

        # Add the key to the attributes
        self.add_attributes({"key": self.id})

        # Compute the icon
        self._compute_icon(icon_position)

    def _compute_icon(self, icon_position: IconPosition | None = None) -> None:
        """
        Compute the icon position and add it to the attributes.
        If no icon position is given, it is computed based on the geometry.

        Parameters
        ----------
        icon_position : IconPosition | None, optional
            The position of the icon on the map. By default None.
        """
        if (
            icon_position is None
            and self.geometries is not None
            and len(self.geometries) > 0
        ):
            # Use the highest lod to create a point
            best_idx = 0
            for idx in range(1, len(self.geometries)):
                if self.geometries[idx].lod > self.geometries[best_idx].lod:
                    best_idx = idx

            icon_position = IconPosition.from_mesh(
                self.geometries[best_idx].to_trimesh(), z_offset=self.icon_z_offset
            )
        self.icon_position = icon_position
        if self.icon_position is not None:
            icon_position_name = ARGUMENT_TO_NAME["icon_position"]
            self.add_attributes(
                {
                    icon_position_name: [
                        self.icon_position.x,
                        self.icon_position.y,
                        self.icon_position.z,
                    ]
                }
            )

    def set_icon(self, icon_position: IconPosition, overwrite: bool = False) -> None:
        self.icon_position = icon_position
        icon_position_name = ARGUMENT_TO_NAME["icon_position"]
        self.add_attributes(
            {
                icon_position_name: [
                    self.icon_position.x,
                    self.icon_position.y,
                    self.icon_position.z,
                ]
            },
            overwrite=overwrite,
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
        """
        Returns the object formatted like a CityJSON object, but without the geometry.

        Returns
        -------
        dict[str, Any]
            Dictionary following CityJSON format for a CityObject, but **without** the
            geometry.
        """
        content_dict = {}
        content_dict["type"] = type(self).type_name
        if self.parent_id is not None:
            content_dict["parents"] = [self.parent_id]
        if len(self.children_ids) > 0:
            content_dict["children"] = list(self.children_ids)
        content_dict["attributes"] = self.attributes.copy()
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

    @abstractmethod
    def apply_attr(self, attr: Attr, overwrite: bool) -> None:
        raise NotImplementedError()

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
        cj_key: str,
        space_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Sequence[Geometry] | None = None,
        icon_position: IconPosition | None = None,
    ) -> None:

        super().__init__(
            cj_key=cj_key,
            attributes=attributes,
            geometries=geometries,
            icon_position=icon_position,
        )
        self.cj_key = cj_key
        self.space_id = space_id
        space_id_key = ARGUMENT_TO_NAME["space_id"]
        self.add_attributes({space_id_key: space_id})
        self.parent_units: set[str] = set()

    def _add_unit(self, new_unit_id: str) -> None:
        self.parent_units.add(new_unit_id)

    def get_cityobject(self) -> dict[str, Any]:
        parent_units_key = ARGUMENT_TO_NAME["parent_units"]
        self.add_attributes({parent_units_key: list(self.parent_units)})
        content_dict = super().get_cityobject()
        # Remove it from the attributes to ensure the object is unchanged
        self.attributes.pop(parent_units_key)
        return content_dict

    @classmethod
    def key_to_prefix(cls, key: str) -> str:
        return f"Building_{key.split(".")[0]}"

    @classmethod
    def key_to_cj_key(cls, key: str) -> str:
        prefix = cls.key_to_prefix(key=key)
        key = key.replace(".", "_").replace("-", "_")
        return f"{prefix}-{cls.type_name}-{key}"


class Building(CityJSONSpace):

    type_name = "Building"
    icon_z_offset = 2

    def __init__(
        self,
        cj_key: str,
        space_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Sequence[Geometry] | None = None,
        icon_position: IconPosition | None = None,
    ) -> None:
        super().__init__(
            cj_key=cj_key,
            space_id=space_id,
            attributes=attributes,
            geometries=geometries,
            icon_position=icon_position,
        )

    def apply_attr(self, attr: BdgAttr, overwrite: bool) -> None:
        self.add_attributes(new_attributes=attr.attributes)
        if attr.icon_position is not None:
            self.set_icon(attr.icon_position, overwrite=overwrite)


class BuildingPart(CityJSONSpace):

    type_name = "BuildingPart"
    icon_z_offset = 1

    def __init__(
        self,
        cj_key: str,
        space_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Sequence[Geometry] | None = None,
        icon_position: IconPosition | None = None,
    ) -> None:
        super().__init__(
            cj_key=cj_key,
            space_id=space_id,
            attributes=attributes,
            geometries=geometries,
            icon_position=icon_position,
        )

    def apply_attr(self, attr: BdgPartAttr, overwrite: bool) -> None:
        self.add_attributes(new_attributes=attr.attributes)
        if attr.icon_position is not None:
            self.set_icon(attr.icon_position, overwrite=overwrite)


class BuildingStorey(CityJSONSpace):

    type_name = "BuildingStorey"
    icon_z_offset = 0.5

    def __init__(
        self,
        cj_key: str,
        space_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Sequence[Geometry] | None = None,
        icon_position: IconPosition | None = None,
    ) -> None:
        super().__init__(
            cj_key=cj_key,
            space_id=space_id,
            attributes=attributes,
            geometries=geometries,
            icon_position=icon_position,
        )

    def apply_attr(self, attr: BdgStoreyAttr, overwrite: bool) -> None:
        self.add_attributes(new_attributes=attr.attributes)
        self.add_attributes(
            new_attributes={
                ARGUMENT_TO_NAME["storey_level"]: attr.storey_level,
                ARGUMENT_TO_NAME["storey_space_id"]: attr.storey_space_id,
            }
        )
        if attr.icon_position is not None:
            self.set_icon(attr.icon_position, overwrite=overwrite)


class BuildingRoom(CityJSONSpace):

    type_name = "BuildingRoom"
    icon_z_offset = 0.5

    def __init__(
        self,
        cj_key: str,
        space_id: str,
        attributes: dict[str, Any] | None = None,
        geometries: Sequence[Geometry] | None = None,
        icon_position: IconPosition | None = None,
    ) -> None:
        super().__init__(
            cj_key=cj_key,
            space_id=space_id,
            attributes=attributes,
            geometries=geometries,
            icon_position=icon_position,
        )

    def apply_attr(self, attr: BdgRoomAttr, overwrite: bool) -> None:
        self.add_attributes(new_attributes=attr.attributes)
        if attr.icon_position is not None:
            self.set_icon(attr.icon_position, overwrite=overwrite)


class BuildingUnitObject(CityJSONObject):

    type_name = "CityObjectGroup"
    icon_z_offset = 2
    id_prefix = "BuildingUnitObject"

    def __init__(self, prefix: str) -> None:
        super().__init__(
            cj_key=f"{prefix}-{self.type_name}-{self.id_prefix}",
            attributes={},
            geometries=None,
            icon_position=None,
        )

    def apply_attr(self, attr: Attr, overwrite: bool) -> None:
        raise NotImplementedError()


class BuildingUnitContainer(CityJSONObject):

    type_name = "CityObjectGroup"
    main_parent_code = ""
    id_prefix = "BuildingUnitContainer"

    def __init__(
        self,
        cj_key: str,
        unit_code: str,
        attributes: dict[str, Any] | None = None,
        icon_position: IconPosition | None = None,
    ) -> None:
        super().__init__(
            cj_key=cj_key,
            attributes=attributes,
            geometries=None,
            icon_position=icon_position,
        )
        self.unit_code = unit_code
        code_name = ARGUMENT_TO_NAME["code"]
        self.add_attributes({code_name: unit_code})

    @classmethod
    def unit_code_to_cj_key(cls, code: str, prefix: str) -> str:
        code = code.replace(".", "_").replace("-", "_")
        prefix = prefix.replace("-", "_")
        return f"{prefix}-{cls.type_name}-{cls.id_prefix}_{code}"

    def apply_attr(self, attr: BdgAttr, overwrite: bool) -> None:
        raise NotImplementedError()


class BuildingUnit(CityJSONObject):

    type_name = "BuildingUnit"
    icon_z_offset = 0.5
    id_prefix = "BuildingUnit"

    def __init__(
        self,
        cj_key: str,
        unit_code: str,
        unit_storeys: list[str],
        geometry: Geometry | None = None,
        attributes: dict[str, Any] | None = None,
        icon_position: IconPosition | None = None,
    ) -> None:
        geometries = [geometry] if geometry is not None else None
        super().__init__(
            cj_key=cj_key,
            geometries=geometries,
            attributes=attributes,
            icon_position=icon_position,
        )
        self.unit_code = unit_code
        code_name = ARGUMENT_TO_NAME["code"]
        self.add_attributes({code_name: unit_code})

        self.unit_storeys = unit_storeys
        storeys_name = ARGUMENT_TO_NAME["unit_storeys"]
        self.add_attributes({storeys_name: unit_storeys})

        self.unit_spaces: set[str] = set()

    def _add_space(self, new_space_id: str) -> None:
        self.unit_spaces.add(new_space_id)

    def get_cityobject(self) -> dict[str, Any]:
        unit_spaces_key = ARGUMENT_TO_NAME["unit_spaces"]
        self.add_attributes({unit_spaces_key: list(self.unit_spaces)})
        content_dict = super().get_cityobject()
        # Remove it from the attributes to ensure the object is unchanged
        self.attributes.pop(unit_spaces_key)
        return content_dict

    @classmethod
    def unit_code_to_code_instance(cls, code: str, index: int) -> str:
        index_str = str(index).replace(".", "_").replace("-", "_")
        code = code.replace(".", "_").replace("-", "_")
        return f"{code}@{index_str}"

    @classmethod
    def unit_code_to_cj_key(cls, code: str, prefix: str, index: int) -> str:
        code_instance = cls.unit_code_to_code_instance(code=code, index=index)
        prefix = prefix.replace("-", "_")
        return f"{prefix}-{cls.type_name}-{cls.id_prefix}_{code_instance}"

    def apply_attr(self, attr: BdgUnitAttr, overwrite: bool) -> None:
        self.add_attributes(new_attributes=attr.attributes)
        if attr.icon_position is not None:
            self.set_icon(attr.icon_position, overwrite=overwrite)


class BuildingNavigationElement(CityJSONObject):

    type_name = "BuildingConstructiveElement"
    icon_z_offset = 0.5
    id_prefix = "BuildingNavigationElement"

    def __init__(
        self,
        cj_key: str,
        geometries: Sequence[Geometry],
        attributes: dict[str, Any] | None = None,
        icon_position: IconPosition | None = None,
    ) -> None:
        super().__init__(
            cj_key=cj_key,
            attributes=attributes,
            geometries=geometries,
            icon_position=icon_position,
        )

    @classmethod
    def number_to_id(cls, prefix: str, number: int) -> str:
        prefix = prefix.replace("-", "_")
        return f"{prefix}-{cls.type_name}-{cls.id_prefix}@{number}"


class BuildingNavigationStairs(BuildingNavigationElement):

    id_prefix = "BuildingNavigationElement"


class BuildingRoot(CityJSONObject):

    type_name = "CityObjectGroup"

    def __init__(
        self,
        cj_key: str,
        attributes: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            cj_key=cj_key,
            attributes=attributes,
            geometries=None,
        )


class OutdoorObject(CityJSONObject):

    type_name = "CityObjectGroup"
    icon_z_offset = 2
    id_prefix = "OutdoorObject"

    def __init__(self, prefix: str) -> None:
        super().__init__(
            cj_key=f"{prefix}-{self.type_name}-{self.id_prefix}",
            attributes={},
            geometries=None,
            icon_position=None,
        )

    def apply_attr(self, attr: Attr, overwrite: bool) -> None:
        raise NotImplementedError()


class OutdoorUnitContainer(BuildingUnitContainer):

    type_name = "CityObjectGroup"
    main_parent_code = ""
    id_prefix = "OutdoorUnitContainer"

    def __init__(
        self,
        cj_key: str,
        unit_code: str,
        attributes: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(
            cj_key=cj_key,
            unit_code=unit_code,
            attributes=attributes,
            icon_position=None,
        )

    def apply_attr(self, attr: BdgAttr, overwrite: bool) -> None:
        raise NotImplementedError()


class OutdoorUnit(BuildingUnitContainer):

    type_name = "GenericCityObject"
    icon_z_offset = 2
    id_prefix = "OutdoorUnit"

    def __init__(
        self,
        cj_key: str,
        unit_code: str,
        attributes: dict[str, Any] | None = None,
        icon_position: IconPosition | None = None,
    ) -> None:
        super().__init__(
            cj_key=cj_key,
            unit_code=unit_code,
            attributes=attributes,
            icon_position=icon_position,
        )

    @classmethod
    def unit_code_to_code_instance(cls, code: str, number: int) -> str:
        number_str = str(number).replace(".", "_").replace("-", "_")
        code = code.replace(".", "_").replace("-", "_")
        return f"{code}@{number_str}"

    @classmethod
    def unit_code_to_id(cls, code: str, prefix: str, number: int) -> str:
        code_instance = cls.unit_code_to_code_instance(code=code, number=number)
        prefix = prefix.replace("-", "_")
        return f"{prefix}-{cls.type_name}-{cls.id_prefix}_{code_instance}"


CityJSONSpaceSubclass = Building | BuildingPart | BuildingStorey | BuildingRoom
CityJSONObjectSubclass = (
    CityJSONSpaceSubclass
    | BuildingUnitObject
    | BuildingUnit
    | BuildingUnitContainer
    | BuildingRoot
    | OutdoorObject
    | OutdoorUnitContainer
    | OutdoorUnit
)
