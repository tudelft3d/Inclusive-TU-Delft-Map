import csv
from pathlib import Path
from typing import Any


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
