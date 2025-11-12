"""
Classes to read and process the attributes of all types of CityJSON objects in a standard way for all types and all branches of the pipeline.
"""

from __future__ import annotations

from abc import ABC
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any, Generic, Type, TypeVar, cast

from data_pipeline.utils.csv_utils import csv_read_attributes
from data_pipeline.utils.icon_positions import IconPosition

KEY_COLUMN = "Key [str]"
SPACE_ID_COLUMN = "CREFM ID [str]"
ICON_POSITION_COLUMN = "Icon Position [list,float]"
BAG_COLUMN = "3D BAG Buildings IDs [list,str]"
SKIP_COLUMN = "Skip [bool]"
PARENT_KEY_COLUMN = "Parent Key [str]"
CODE_COLUMN = "Type Code [str]"
UNIT_GLTF_COLUMN = "glTF Name [str]"
UNIT_SPACES_COLUMN = "CREFM IDs [list,str]"
UNIT_STOREYS_COLUMN = "Storeys [list,str]"
STOREY_LEVEL_COLUMN = "Level [float]"
STOREY_SPACE_ID_COLUMN = "Storey CREFM ID [str]"

ARGUMENT_TO_NAME = {
    "cj_key": "cj_key",
    "space_id": "space_id",
    "icon_position": "icon_position",
    "bag_ids": "bag_ids",
    "skip": "skip",
    "parent_cj_key": "parent_cj_key",
    "code": "code",
    "unit_gltf": "unit_gltf",
    "unit_spaces": "unit_spaces",
    "unit_storeys": "unit_storeys",
    "parent_units": "parent_units",
    "storey_level": "storey_level",
    "storey_space_id": "storey_space_id",
}

COL_TO_NAME = {
    KEY_COLUMN: "cj_key",
    SPACE_ID_COLUMN: "space_id",
    ICON_POSITION_COLUMN: "icon_position",
    BAG_COLUMN: "bag_ids",
    SKIP_COLUMN: "skip",
    PARENT_KEY_COLUMN: "parent_cj_key",
    CODE_COLUMN: "code",
    UNIT_GLTF_COLUMN: "unit_gltf",
    UNIT_SPACES_COLUMN: "unit_spaces",
    UNIT_STOREYS_COLUMN: "unit_storeys",
    STOREY_LEVEL_COLUMN: "storey_level",
    STOREY_SPACE_ID_COLUMN: "storey_space_id",
}


class Attr(ABC):
    """
    Base abstract class to store attributes.
    """

    specific_columns: tuple[str, ...] = (KEY_COLUMN,)
    key_index: int | None = 0
    key_builder_index: int | None = None

    def __init__(
        self,
        attributes: dict[str, Any],
        cj_key: str,
        icon_position: IconPosition | list[float] | None,
    ) -> None:
        self.attributes = attributes
        self.cj_key = cj_key
        if isinstance(icon_position, IconPosition):
            self.icon_position = icon_position
        elif icon_position is None or len(icon_position) == 0:
            self.icon_position = None
        else:
            self.icon_position = IconPosition.from_list(icon_position)


class BdgAttr(Attr):
    """
    Class to store the attributes of Building objects.
    """

    specific_columns = (
        KEY_COLUMN,
        SPACE_ID_COLUMN,
        BAG_COLUMN,
        SKIP_COLUMN,
        ICON_POSITION_COLUMN,
    )
    key_index = 0
    key_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        cj_key: str,
        space_id: str,
        icon_position: IconPosition | list[float] | None,
        bag_ids: list[str],
        skip: bool,
    ) -> None:
        super().__init__(
            attributes=attributes, cj_key=cj_key, icon_position=icon_position
        )
        self.bag_ids = bag_ids
        self.skip = skip
        self.space_id = space_id


class BdgSubAttr(Attr):
    """
    Class to store the attributes of building subdivisions.
    """

    specific_columns = (
        KEY_COLUMN,
        SPACE_ID_COLUMN,
        PARENT_KEY_COLUMN,
        SKIP_COLUMN,
        ICON_POSITION_COLUMN,
    )
    key_index = 0
    key_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        cj_key: str,
        space_id: str,
        icon_position: IconPosition | list[float] | None,
        parent_cj_key: str,
        skip: bool,
    ) -> None:
        super().__init__(
            attributes=attributes, cj_key=cj_key, icon_position=icon_position
        )
        self.parent_cj_key = parent_cj_key
        self.skip = skip
        self.space_id = space_id


class BdgPartAttr(Attr):
    """
    Class to store the attributes of BuildingPart objects.
    """

    specific_columns = (SPACE_ID_COLUMN,)
    key_index = 0
    key_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        space_id: str,
    ) -> None:
        super().__init__(attributes=attributes, cj_key=space_id, icon_position=None)
        self.space_id = space_id


class BdgStoreyAttr(Attr):
    """
    Class to store the attributes of BuildingStorey objects.
    """

    specific_columns = (SPACE_ID_COLUMN, STOREY_LEVEL_COLUMN, STOREY_SPACE_ID_COLUMN)
    key_index = 0
    key_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        space_id: str,
        storey_level: float,
        storey_space_id: str,
    ) -> None:
        super().__init__(attributes=attributes, cj_key=space_id, icon_position=None)
        self.space_id = space_id
        self.storey_level = storey_level
        self.storey_space_id = storey_space_id


class BdgRoomAttr(Attr):
    """
    Class to store the attributes of BuildingRoom objects.
    """

    specific_columns = (SPACE_ID_COLUMN, ICON_POSITION_COLUMN, CODE_COLUMN)
    key_index = 0
    key_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        space_id: str,
        icon_position: IconPosition | list[float] | None,
        code: str,
    ) -> None:
        super().__init__(
            attributes=attributes, cj_key=space_id, icon_position=icon_position
        )
        self.space_id = space_id
        self.code = code


class BdgUnitAttr(Attr):
    """
    Class to store the attributes of BuildingUnit objects.
    """

    specific_columns = (
        ICON_POSITION_COLUMN,
        CODE_COLUMN,
        UNIT_GLTF_COLUMN,
        UNIT_SPACES_COLUMN,
        UNIT_STOREYS_COLUMN,
    )
    key_index = None
    key_builder_index = 0

    def __init__(
        self,
        attributes: dict[str, Any],
        cj_key: str,
        icon_position: IconPosition | list[float] | None,
        code: str,
        unit_gltf: str,
        unit_spaces: list[str],
        unit_storeys: list[str],
    ) -> None:
        super().__init__(
            attributes=attributes, cj_key=cj_key, icon_position=icon_position
        )
        self.code = code
        self.unit_gltf = None if unit_gltf == "" else unit_gltf
        self.unit_spaces = unit_spaces
        self.unit_storeys = unit_storeys

        if len(self.unit_storeys) == 0:
            unit_storeys_set: set[str] = set()
            for space in self.unit_spaces:
                space_split = space.split(".")
                if len(space.split(".")) < 3:
                    continue
                storey = ".".join(space_split[:3])
                unit_storeys_set.add(storey)
            self.unit_storeys = list(unit_storeys_set)


A = TypeVar("A", bound=Attr)


class AttrReader(Generic[A], ABC):
    """
    Base abstract class to read attributes from CSV.
    """

    attr_class: Type[A]

    def __init__(self, csv_path: Path) -> None:
        self.csv_path = csv_path
        self.specific_columns = self.attr_class.specific_columns
        self._key_to_attr: dict[str, A] = {}
        self._key_builder_counts = defaultdict(lambda: 0)
        self._read_attributes()
        self._organise_attributes()

    def _read_attributes(self) -> None:
        self.attributes_all, self.specific_values_all = csv_read_attributes(
            csv_path=self.csv_path, specific_columns=self.specific_columns
        )

    def _organise_attributes(self) -> None:
        if (
            self.attr_class.key_index is None
            and self.attr_class.key_builder_index is None
        ):
            raise RuntimeError(
                "Cannot have both `key_index` and `key_builder_index` be None."
            )

        for attributes, specific_values in zip(
            self.attributes_all, self.specific_values_all
        ):
            if self.attr_class.key_index is None:
                col_name, key_base_value = specific_values[
                    cast(int, self.attr_class.key_builder_index)
                ]
                cj_key = self._build_cj_key(col_name)
            else:
                _, cj_key = specific_values[self.attr_class.key_index]

            specific_values_map = {}
            for specific_col, col_name_value in zip(
                self.attr_class.specific_columns, specific_values
            ):
                name = COL_TO_NAME[specific_col]
                _, value = col_name_value
                specific_values_map[name] = value

            if self.attr_class.key_index is None:
                specific_values_map["cj_key"] = cj_key

            self._key_to_attr[cj_key] = self.attr_class(
                attributes=attributes, **specific_values_map
            )

    def _build_cj_key(self, col_name: str) -> str:
        count = self._key_builder_counts[col_name]
        cj_key = f"{col_name}@{count}"
        self._key_builder_counts[col_name] += 1
        return cj_key

    def get_key_to_attr(self):
        return deepcopy(self._key_to_attr)

    def get_attributes_by_cj_key(self, cj_key: str):
        try:
            return self._key_to_attr[cj_key]
        except KeyError as exc:
            raise ValueError(f"Object key '{cj_key}' does not exist.") from exc

    def __len__(self):
        return len(self._key_to_attr)

    def iterator(self):
        return iter(self._key_to_attr.items())


class BdgAttrReader(AttrReader[BdgAttr]):
    """
    Class to read attributes of Building objecys from CSV.
    """

    attr_class = BdgAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)


class BdgSubAttrReader(AttrReader[BdgSubAttr]):
    """
    Class to read attributes of building subdivisions from CSV.
    """

    attr_class = BdgSubAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)


class BdgPartAttrReader(AttrReader[BdgPartAttr]):
    """
    Class to read attributes of BuildingPart objects from CSV.
    """

    attr_class = BdgPartAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)


class BdgStoreyAttrReader(AttrReader[BdgStoreyAttr]):
    """
    Class to read attributes of BuildingStorey objects from CSV.
    """

    attr_class = BdgStoreyAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)


class BdgRoomAttrReader(AttrReader[BdgRoomAttr]):
    """
    Class to read attributes of BuildingRoom objects from CSV.
    """

    attr_class = BdgRoomAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)


class BdgUnitAttrReader(AttrReader[BdgUnitAttr]):
    """
    Class to read attributes of BuildingUnit objects from CSV.
    """

    attr_class = BdgUnitAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)
