import json
from pathlib import Path

from csv_utils import csv_read_attributes


def format_codelist(input_csv_path: Path, output_json_path: Path):
    specific_columns = ("Code [str]",)
    attributes_all, specific_values_all = csv_read_attributes(
        csv_path=input_csv_path, specific_columns=specific_columns
    )
    codes_attributes = {}
    for attributes, specific_values in zip(attributes_all, specific_values_all):
        _, code = specific_values[0]
        if code in codes_attributes:
            raise RuntimeError(f"The code '{code}' is duplicated in the input.")
        if code == "":
            raise RuntimeError("One row misses its code.")
        codes_attributes[code] = attributes

    output_json_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_json_path, "w") as f:
        f.write(json.dumps(codes_attributes))
