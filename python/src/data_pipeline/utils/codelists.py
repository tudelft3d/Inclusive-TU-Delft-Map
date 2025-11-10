"""
Format the usage codelist into a convenient JSON file for the JavaScript app.
"""

import json
from collections import defaultdict
from pathlib import Path

from data_pipeline.utils.csv_utils import csv_read_attributes


def format_codelist_json(input_csv_path: Path, output_json_path: Path):
    """
    Helper script to format the CSV codelist into a more convenient JSON file.

    Parameters
    ----------
    input_csv_path : Path
        The input CSV path to the codelist.
    output_json_path : Path
        The output JSON path of the formatted codelist.

    Raises
    ------
    RuntimeError
        If a code is duplicated in the input.
    RuntimeError
        If a CSV row does not have a code.
    """
    specific_columns = ("Code [str]", "Implies [list,str]")
    attributes_all, specific_values_all = csv_read_attributes(
        csv_path=input_csv_path, specific_columns=specific_columns
    )
    codes_attributes = {}
    codes_implied_by = defaultdict(lambda: [])
    for attributes, specific_values in zip(attributes_all, specific_values_all):
        _, code = specific_values[0]
        implies_column, implies_value = specific_values[1]
        if code in codes_attributes:
            raise RuntimeError(f"The code '{code}' is duplicated in the input.")
        if code == "":
            raise RuntimeError("One row misses its code.")
        attributes[implies_column] = implies_value
        codes_attributes[code] = attributes

        # Store the implication backwards
        for code_implied in implies_value:
            codes_implied_by[code_implied].append(code)

    # Compute the implication backwards
    for code in codes_attributes.keys():
        codes_attributes[code]["Implied by"] = codes_implied_by[code]

    output_json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_json_path, "w") as f:
        f.write(json.dumps(codes_attributes))
