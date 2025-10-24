from __future__ import annotations

from abc import ABC
from collections import defaultdict
from copy import deepcopy
from pathlib import Path
from typing import Any, Generic, Type, TypeVar, cast

from cj_geometry import IconPosition
from csv_utils import csv_read_attributes

ID_COLUMN = "Number [str]"
ICON_POSITION_COLUMN = "Icon Position [list,float]"
BAG_COLUMN = "3D BAG Buildings IDs [list,str]"
SKIP_COLUMN = "Skip [bool]"
PARENT_ID_COLUMN = "Parent Number [str]"
CODE_COLUMN = "Type Code [str]"
UNIT_GLTF_COLUMN = "glTF Name [str]"
UNIT_SPACES_COLUMN = "Numbers [list,str]"
UNIT_STOREYS_COLUMN = "Storeys [list,str]"
STOREY_LEVEL_COLUMN = "Level [float]"
STOREY_ID_COLUMN = "Storey Number [str]"

ARGUMENT_TO_NAME = {
    "object_id": "object_id",
    "icon_position": "icon_position",
    "bag_ids": "bag_ids",
    "skip": "skip",
    "parent_object_id": "parent_object_id",
    "code": "code",
    "unit_spaces": "unit_spaces",
    "unit_storeys": "unit_storeys",
    "parent_units": "parent_units",
    "space_id": "space_id",
}

COL_TO_NAME = {
    ID_COLUMN: "object_id",
    ICON_POSITION_COLUMN: "icon_position",
    BAG_COLUMN: "bag_ids",
    SKIP_COLUMN: "skip",
    PARENT_ID_COLUMN: "parent_object_id",
    CODE_COLUMN: "code",
    UNIT_GLTF_COLUMN: "unit_gltf",
    UNIT_SPACES_COLUMN: "unit_spaces",
    UNIT_STOREYS_COLUMN: "unit_storeys",
    STOREY_LEVEL_COLUMN: "storey_level",
    STOREY_ID_COLUMN: "storey_id",
}


class Attr(ABC):

    specific_columns: tuple[str, ...] = (ID_COLUMN,)
    id_index: int | None = 0
    id_builder_index: int | None = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: IconPosition | list[float] | None,
    ) -> None:
        self.attributes = attributes
        self.object_id = object_id
        if isinstance(icon_position, IconPosition):
            self.icon_position = icon_position
        elif icon_position is None or len(icon_position) == 0:
            self.icon_position = None
        else:
            self.icon_position = IconPosition.from_list(icon_position)


class BdgAttr(Attr):

    specific_columns = (ID_COLUMN, BAG_COLUMN, SKIP_COLUMN, ICON_POSITION_COLUMN)
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: IconPosition | list[float] | None,
        bag_ids: list[str],
        skip: bool,
    ) -> None:
        super().__init__(
            attributes=attributes, object_id=object_id, icon_position=icon_position
        )
        self.bag_ids = bag_ids
        self.skip = skip


class BdgSubAttr(Attr):

    specific_columns = (ID_COLUMN, PARENT_ID_COLUMN, SKIP_COLUMN, ICON_POSITION_COLUMN)
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: IconPosition | list[float] | None,
        parent_object_id: str,
        skip: bool,
    ) -> None:
        super().__init__(
            attributes=attributes, object_id=object_id, icon_position=icon_position
        )
        self.parent_object_id = parent_object_id
        self.skip = skip


class BdgPartAttr(Attr):

    specific_columns = (ID_COLUMN,)
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
    ) -> None:
        super().__init__(attributes=attributes, object_id=object_id, icon_position=None)


class BdgStoreyAttr(Attr):

    specific_columns = (ID_COLUMN, STOREY_LEVEL_COLUMN, STOREY_ID_COLUMN)
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        storey_level: float,
        storey_id: str,
    ) -> None:
        super().__init__(attributes=attributes, object_id=object_id, icon_position=None)
        self.storey_level = storey_level
        self.storey_id = storey_id


class BdgRoomAttr(Attr):

    specific_columns = (ID_COLUMN, ICON_POSITION_COLUMN, CODE_COLUMN)
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: IconPosition | list[float] | None,
        code: str,
    ) -> None:
        super().__init__(
            attributes=attributes, object_id=object_id, icon_position=icon_position
        )
        self.code = code


class BdgUnitCtnrAttr(Attr):

    specific_columns = (CODE_COLUMN, UNIT_SPACES_COLUMN, ICON_POSITION_COLUMN)
    id_index = None
    id_builder_index = 0

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: IconPosition | list[float] | None,
        code: str,
    ) -> None:
        super().__init__(
            attributes=attributes, object_id=object_id, icon_position=icon_position
        )
        self.code = code


class BdgUnitAttr(Attr):

    specific_columns = (
        ICON_POSITION_COLUMN,
        CODE_COLUMN,
        UNIT_GLTF_COLUMN,
        UNIT_SPACES_COLUMN,
        UNIT_STOREYS_COLUMN,
    )
    id_index = None
    id_builder_index = 0

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: IconPosition | list[float] | None,
        code: str,
        unit_gltf: str,
        unit_spaces: list[str],
        unit_storeys: list[str],
    ) -> None:
        super().__init__(
            attributes=attributes, object_id=object_id, icon_position=icon_position
        )
        self.code = code
        self.unit_gltf = None if unit_gltf == "" else unit_gltf
        self.unit_spaces = unit_spaces
        self.unit_storeys = unit_storeys

        if len(self.unit_storeys) == 0:
            unit_storeys_set: set[str] = set()
            for space in self.unit_spaces:
                storey = ".".join(space.split(".")[:-1])
                unit_storeys_set.add(storey)
            self.unit_storeys = list(unit_storeys_set)


A = TypeVar("A", bound=Attr)


class AttrReader(Generic[A], ABC):

    attr_class: Type[A]

    def __init__(self, csv_path: Path) -> None:
        self.csv_path = csv_path
        self.specific_columns = self.attr_class.specific_columns
        self._id_to_attr: dict[str, A] = {}
        self._id_builder_counts = defaultdict(lambda: 0)
        self._read_attributes()
        self._organise_attributes()

    def _read_attributes(self) -> None:
        self.attributes_all, self.specific_values_all = csv_read_attributes(
            csv_path=self.csv_path, specific_columns=self.specific_columns
        )

    def _organise_attributes(self) -> None:
        if (
            self.attr_class.id_index is None
            and self.attr_class.id_builder_index is None
        ):
            raise RuntimeError(
                "Cannot have both `id_index` and `id_builder_index` be None."
            )

        for attributes, specific_values in zip(
            self.attributes_all, self.specific_values_all
        ):
            if self.attr_class.id_index is None:
                col_name, id_base_value = specific_values[
                    cast(int, self.attr_class.id_builder_index)
                ]
                object_id = self._build_object_id(col_name)
            else:
                _, object_id = specific_values[self.attr_class.id_index]

            specific_values_map = {}
            for specific_col, col_name_value in zip(
                self.attr_class.specific_columns, specific_values
            ):
                name = COL_TO_NAME[specific_col]
                _, value = col_name_value
                specific_values_map[name] = value

            if self.attr_class.id_index is None:
                specific_values_map["object_id"] = object_id

            self._id_to_attr[object_id] = self.attr_class(
                attributes=attributes, **specific_values_map
            )

    def _build_object_id(self, col_name: str) -> str:
        count = self._id_builder_counts[col_name]
        object_id = f"{col_name}@{count}"
        self._id_builder_counts[col_name] += 1
        return object_id

    def get_id_to_attr(self):
        return deepcopy(self._id_to_attr)

    def get_attributes_by_object_id(self, object_id: str):
        try:
            return self._id_to_attr[object_id]
        except KeyError as exc:
            raise ValueError(f"Object id '{object_id}' does not exist.") from exc

    def __len__(self):
        return len(self._id_to_attr)

    def iterator(self):
        return iter(self._id_to_attr.items())


class BdgAttrReader(AttrReader[BdgAttr]):

    attr_class = BdgAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)


class BdgSubAttrReader(AttrReader[BdgSubAttr]):

    attr_class = BdgSubAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)


class BdgPartAttrReader(AttrReader[BdgPartAttr]):

    attr_class = BdgPartAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)


class BdgStoreyAttrReader(AttrReader[BdgStoreyAttr]):

    attr_class = BdgStoreyAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)


class BdgRoomAttrReader(AttrReader[BdgRoomAttr]):

    attr_class = BdgRoomAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)


class BdgUnitAttrReader(AttrReader[BdgUnitAttr]):

    attr_class = BdgUnitAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)
