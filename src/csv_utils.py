from __future__ import annotations

import csv
from abc import ABC
from collections import defaultdict
from pathlib import Path
from typing import Any, Generic, Type, TypeVar, cast

from cj_geometry import IconPosition
from constants import (
    BAG_COLUMN,
    ICON_POSITION_COLUMN,
    ID_COLUMN,
    PARENT_ID_COLUMN,
    SKIP_COLUMN,
    UNIT_CODE_COLUMN,
    UNIT_SPACES_COLUMN,
)


def csv_format_type(value: str, column_type: str) -> Any:
    if column_type == "str":
        return str(value)
    elif column_type == "float":
        if value == "":
            return None
        return float(value.replace(",", "."))
    elif column_type == "int":
        if value == "":
            return None
        return int(value)
    elif column_type == "bool":
        if value == "":
            return None
        return value.lower() == "true"
    elif column_type.startswith("list"):
        if value == "":
            return []
        list_info = column_type[len("list") :]
        separator = list_info[0]
        other_type = list_info[1:]
        return [
            csv_format_type(value=v, column_type=other_type)
            for v in value.split(separator)
        ]
    else:
        raise NotImplementedError(
            f"Support for type '{column_type}' is not implemented yet."
        )


def csv_get_row_value(row: dict[str, str], column: str) -> tuple[str, Any]:
    value = row[column].strip()
    if not isinstance(value, str):
        raise RuntimeError(
            f"The column '{column}' gave a value of type {type(value)} ({value})."
        )
    column_split = column.split(" [")
    if len(column_split) != 2:
        raise RuntimeError(
            f"The column name should look like this: '<Name> [<type>]', but it is '{column}'."
        )
    column_type = column_split[1][:-1]
    column_name = column_split[0]
    return column_name, csv_format_type(value=value, column_type=column_type)


def csv_read_attributes(
    csv_path: Path, specific_columns: tuple[str, ...] = ()
) -> tuple[list[dict[str, Any]], list[tuple[tuple[str, Any], ...]]]:
    attributes_all: list[dict[str, Any]] = []
    specific_values_all: list[tuple[tuple[str, Any], ...]] = []

    with open(csv_path, encoding="utf-8-sig") as csvfile:
        reader = csv.DictReader(csvfile, delimiter=";")
        for row in reader:
            # Skip empty rows
            if not any(cell != "" for cell in row.values()):
                continue
            # Process the specific columns
            specific_values_list: list[tuple[str, Any]] = []
            for specific_column in specific_columns:
                specific_values_list.append(
                    csv_get_row_value(row=row, column=specific_column)
                )
                row.pop(specific_column)
            specific_values_all.append(tuple(specific_values_list))

            # Load as attributes the columns that contain a type
            attributes = {}
            for col_name_type in row.keys():
                # Skip columns that don't have a type
                if col_name_type.find(" [") == -1:
                    continue
                # Add the column and its value to the attributes
                col_name, col_value = csv_get_row_value(row=row, column=col_name_type)
                if col_name in attributes:
                    raise RuntimeError(
                        f"Two columns have the same name '{col_name}' in {str(csv_path)}"
                    )
                attributes[col_name] = col_value
            attributes_all.append(attributes)

    return attributes_all, specific_values_all


class Attr:

    specific_columns: dict[str, str] = {
        ID_COLUMN: "object_id",
    }
    id_index: int | None = 0
    id_builder_index: int | None = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
    ) -> None:
        self.attributes = attributes
        self.object_id = object_id


class BdgAttr(Attr):

    specific_columns = {
        ID_COLUMN: "object_id",
        BAG_COLUMN: "bag_ids",
        SKIP_COLUMN: "skip",
        ICON_POSITION_COLUMN: "icon_position",
    }
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        bag_ids: list[str],
        skip: bool,
        icon_position: list[float],
    ) -> None:
        super().__init__(attributes=attributes, object_id=object_id)
        self.bag_ids = bag_ids
        self.skip = skip
        if len(icon_position) == 0:
            self.icon_position = None
        else:
            self.icon_position = IconPosition.from_list(icon_position)


class BdgSubAttr(Attr):

    specific_columns = {
        ID_COLUMN: "object_id",
        PARENT_ID_COLUMN: "parent_object_id",
        SKIP_COLUMN: "skip",
        ICON_POSITION_COLUMN: "icon_position",
    }
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        parent_object_id: str,
        skip: bool,
        icon_position: list[float],
    ) -> None:
        super().__init__(attributes=attributes, object_id=object_id)
        self.parent_object_id = parent_object_id
        self.skip = skip
        if len(icon_position) == 0:
            self.icon_position = None
        else:
            self.icon_position = IconPosition.from_list(icon_position)


class BdgPartAttr(Attr):

    specific_columns = {
        ID_COLUMN: "object_id",
        ICON_POSITION_COLUMN: "icon_position",
    }
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: list[float],
    ) -> None:
        super().__init__(attributes=attributes, object_id=object_id)
        if len(icon_position) == 0:
            self.icon_position = None
        else:
            self.icon_position = IconPosition.from_list(icon_position)


class BdgStoreyAttr(Attr):

    specific_columns = {
        ID_COLUMN: "object_id",
        ICON_POSITION_COLUMN: "icon_position",
    }
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: list[float],
    ) -> None:
        super().__init__(attributes=attributes, object_id=object_id)
        if len(icon_position) == 0:
            self.icon_position = None
        else:
            self.icon_position = IconPosition.from_list(icon_position)


class BdgRoomAttr(Attr):

    specific_columns = {
        ID_COLUMN: "object_id",
        ICON_POSITION_COLUMN: "icon_position",
    }
    id_index = 0
    id_builder_index = None

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        icon_position: list[float],
    ) -> None:
        super().__init__(attributes=attributes, object_id=object_id)
        if len(icon_position) == 0:
            self.icon_position = None
        else:
            self.icon_position = IconPosition.from_list(icon_position)


class BdgUnitAttr(Attr):

    specific_columns = {
        UNIT_CODE_COLUMN: "unit_code",
        UNIT_SPACES_COLUMN: "unit_spaces",
        ICON_POSITION_COLUMN: "icon_position",
    }
    id_index = None
    id_builder_index = 0

    def __init__(
        self,
        attributes: dict[str, Any],
        object_id: str,
        unit_code: str,
        unit_spaces: list[str],
        icon_position: list[float],
    ) -> None:
        super().__init__(attributes=attributes, object_id=object_id)
        self.unit_code = unit_code
        self.unit_spaces = unit_spaces
        if len(icon_position) == 0:
            self.icon_position = None
        else:
            self.icon_position = IconPosition.from_list(icon_position)


A = TypeVar("A", bound=Attr)


class AttrReader(Generic[A], ABC):

    attr_class: Type[A]

    def __init__(self, csv_path: Path) -> None:
        self.csv_path = csv_path
        self.specific_columns = tuple(self.attr_class.specific_columns.keys())
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
            for name, col_name_value in zip(
                self.attr_class.specific_columns.values(), specific_values
            ):
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
