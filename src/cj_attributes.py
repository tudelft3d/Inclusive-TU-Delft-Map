from __future__ import annotations

from abc import ABC
from collections import defaultdict
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
UNIT_SPACES_COLUMN = "Numbers [list,str]"
ARGUMENT_TO_NAME = {
    "object_id": "object_id",
    "icon_position": "icon_position",
    "bag_ids": "bag_ids",
    "skip": "skip",
    "parent_object_id": "parent_object_id",
    "code": "code",
    "unit_spaces": "unit_spaces",
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
    UNIT_SPACES_COLUMN: "unit_spaces",
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

    specific_columns = (ID_COLUMN, ICON_POSITION_COLUMN)
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: IconPosition | list[float] | None,
    ) -> None:
        super().__init__(
            attributes=attributes, object_id=object_id, icon_position=icon_position
        )


class BdgStoreyAttr(Attr):

    specific_columns = (ID_COLUMN, ICON_POSITION_COLUMN)
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: IconPosition | list[float] | None,
    ) -> None:
        super().__init__(
            attributes=attributes, object_id=object_id, icon_position=icon_position
        )


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

    specific_columns = (CODE_COLUMN, UNIT_SPACES_COLUMN, ICON_POSITION_COLUMN)
    id_index = None
    id_builder_index = 0

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: IconPosition | list[float] | None,
        code: str,
        unit_spaces: list[str],
    ) -> None:
        super().__init__(
            attributes=attributes, object_id=object_id, icon_position=icon_position
        )
        self.code = code
        self.unit_spaces = unit_spaces


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
                _, id_base_value = specific_values[
                    cast(int, self.attr_class.id_builder_index)
                ]
                object_id = self._build_object_id(id_base_value)
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

    def _build_object_id(self, value: str) -> str:
        count = self._id_builder_counts[value]
        object_id = f"{value}@{count}"
        self._id_builder_counts[value] += 1
        return object_id

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


class BdgUnitAttrReader(AttrReader[BdgUnitAttr]):

    attr_class = BdgUnitAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)


class BdgRoomAttrReader(AttrReader[BdgRoomAttr]):

    attr_class = BdgRoomAttr

    def __init__(self, csv_path: Path) -> None:
        super().__init__(csv_path)
