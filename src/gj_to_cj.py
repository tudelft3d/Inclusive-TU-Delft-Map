import json
from collections import defaultdict
from pathlib import Path
from pprint import pprint
from typing import Any

import numpy as np

from cj_geometry import IconPosition
from cj_objects import (
    CityJSONFile,
    CityJSONObject,
    OutdoorObject,
    OutdoorUnit,
    OutdoorUnitContainer,
)
from csv_utils import csv_get_row_value


def load_geojson_icons(gj_path: Path, output_cj_path: Path):
    with open(gj_path) as gj_file:
        gj_data: dict[str, Any] = json.load(gj_file)
    if gj_data.get("type", "") != "FeatureCollection":
        raise NotImplementedError(
            f"Only 'FeatureCollection' is supported for now, not '{gj_data.get("type", "")}'"
        )
    if (
        gj_data.get("crs", {}).get("properties", {}).get("name", "")
        != "urn:ogc:def:crs:EPSG::7415"
    ):
        raise NotImplementedError(
            f"Only 'EPSG:7415' is supported for now, not '{gj_data.get("crs", {})}'"
        )

    prefix = "Outdoor"
    outdoor_container = OutdoorObject(prefix=prefix)

    all_units: dict[str, list[OutdoorUnit]] = defaultdict(lambda: [])
    for feature in gj_data.get("features", []):
        # Extract the code
        attributes = feature["properties"]
        code_column = "Type Code [str]"
        if code_column not in attributes:
            raise RuntimeError(
                "At least one feature is missing the attribute 'code_column'"
            )
        unit_code = attributes[code_column]
        if unit_code is None:
            continue

        # Compute the id
        current_units_same_code = len(all_units[unit_code])
        unit_id = OutdoorUnit.unit_code_to_id(
            code=unit_code, prefix=prefix, number=current_units_same_code
        )

        # Get the icon position
        geometry = feature["geometry"]
        if geometry.get("type", "") != "Point":
            raise NotImplementedError(
                f"Only the 'Point' geometry is supported, not '{geometry.get("type", "")}"
            )

        icon_coordinates: list[float] = geometry["coordinates"]
        if len(geometry) == 2:
            icon_coordinates.append(0)
        icon_position = IconPosition.from_list(icon_coordinates)

        attributes = {}
        for key, value in feature["properties"].items():
            if key.endswith("]"):
                col_name, col_value = csv_get_row_value(row={key: value}, column=key)
                attributes[col_name] = col_value

        # Create the outdoor unit
        unit = OutdoorUnit(
            cj_key=unit_id,
            unit_code=unit_code,
            attributes=attributes,
            icon_position=icon_position,
        )
        all_units[unit_code].append(unit)

    # Create the unit containers
    unit_containers: list[OutdoorUnitContainer] = []
    for code, units in all_units.items():
        unit_container_id = OutdoorUnitContainer.unit_code_to_cj_key(
            code=code, prefix=prefix
        )
        unit_container = OutdoorUnitContainer(
            cj_key=unit_container_id, unit_code=code, attributes={}
        )
        unit_containers.append(unit_container)

        CityJSONObject.add_parent_child(parent=outdoor_container, child=unit_container)
        for unit in units:
            CityJSONObject.add_parent_child(parent=unit_container, child=unit)

    cj_file = CityJSONFile(
        scale=np.array([0.00001, 0.00001, 0.00001], dtype=np.float64),
        translate=np.array([0, 0, 0], dtype=np.float64),
    )

    cj_file.add_cityjson_objects([outdoor_container])
    cj_file.add_cityjson_objects(unit_containers)
    cj_file.add_cityjson_objects(
        [unit for units in all_units.values() for unit in units]
    )

    # Check the correctness of the hierarchy
    cj_file.check_objects_hierarchy()

    # Write to CityJSON
    output_cj_path.parent.mkdir(parents=True, exist_ok=True)
    file_json = cj_file.to_json()
    with open(output_cj_path, "w") as f:
        f.write(file_json)
