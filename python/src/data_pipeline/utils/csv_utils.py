"""
Process CSV files and add more robustness to the data manipulation by extracting and using a data type stored in the header of the CSV for each column.
"""

import csv
from pathlib import Path
from typing import Any


def csv_format_type(value: str, column_type: str) -> Any:
    """
    Convert a given value extracted from CSV into the given type.

    Parameters
    ----------
    value : str
        Initial value.
    column_type : str
        Type to transform it into.

    Returns
    -------
    Any
        The converted value.

    Raises
    ------
    NotImplementedError
        If the given type is unsupported.
    """
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


def string_to_type(type_string: str) -> type:
    """
    Return the actual Python type corresponding to the string.

    Parameters
    ----------
    type_string : str
        The type represented as a string.

    Returns
    -------
    type
        The actual type.

    Raises
    ------
    NotImplementedError
        If the given type is unsupported.
    """
    if type_string == "str":
        real_type = str
    elif type_string == "float":
        real_type = float
    elif type_string == "int":
        real_type = int
    elif type_string == "bool":
        real_type = bool
    elif type_string.startswith("list"):
        real_type = list
    else:
        raise NotImplementedError(
            f"Support for type '{type_string}' is not implemented yet."
        )
    return real_type


def check_type(value: Any, column_types: list[str]) -> bool:
    """
    Check if the type of the given value is one of the given expected types.

    Parameters
    ----------
    value : Any
        Value to check.
    column_types : list[str]
        List of allowed types, represented as strings.

    Returns
    -------
    bool
        Whether the type of the value is one of the expected types.
    """
    for column_type in column_types:
        real_type = string_to_type(column_type)
        if real_type == list:
            if not isinstance(value, list):
                continue

            list_info = column_type[len("list") :]
            separator = list_info[0]
            other_type = list_info[1:]
            if all([check_type(item, [other_type]) for item in value]):
                return True
        elif isinstance(value, real_type):
            return True

    return False


def csv_get_row_value(row: dict[str, str], column: str) -> tuple[str, Any]:
    """
    Extract the value of a specific column of the given row, and convert it ot the type specified by the column header.

    Parameters
    ----------
    row : dict[str, str]
        The row as a mapping the column name to the value.
    column : str
        The column to extract.

    Returns
    -------
    str
        The actual name of the column without the type.
    Any
        The value of the column.

    Raises
    ------
    RuntimeError
        If the column header is not formatted properly.
    RuntimeError
        If the type of the output is not correct.
    """
    column_split = column.split(" [")
    if len(column_split) != 2:
        raise RuntimeError(
            f"The column name should look like this: '<Name> [<type>]', but it is '{column}'."
        )
    column_type = column_split[1][:-1]
    column_name = column_split[0]

    value = row[column]
    if isinstance(value, str):
        value = csv_format_type(value=value.strip(), column_type=column_type)

    if check_type(value=value, column_types=[column_type]) or value is None:
        pass
    else:
        raise RuntimeError(
            f"The column '{column}' gave a value of type {type(value)} ({value})."
        )

    return column_name, value


def csv_read_attributes(
    csv_path: Path, specific_columns: tuple[str, ...] = ()
) -> tuple[list[dict[str, Any]], list[tuple[tuple[str, Any], ...]]]:
    """
    Read all the values from a given CSV file and convert all the values according to the types specified by the header.
    Some specific columns that have to be in the file can be specified.

    Parameters
    ----------
    csv_path : Path
        The path to the CSV file.
    specific_columns : tuple[str, ...], optional
        The mandatory columns.
        By default ().

    Returns
    -------
    attributes_all: list[dict[str, Any]]
        All the values of all the rows, except the ones given in `specific_columns`.
        Stored as dictionaries mapping the actual column name (without the type) to the value converted to the right type.
    specific_values_all: list[tuple[tuple[str, Any], ...]]
        The values of the columns specified in `specific_columns`, in the same order.
        Each element of the list corresponds to one row, in the same order as in `attributes_all`.

    Raises
    ------
    RuntimeError
        If two columns end up with the same name after removing the type.
    """
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
