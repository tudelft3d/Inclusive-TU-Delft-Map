import json
from collections import defaultdict
from pathlib import Path
from pprint import pprint
from typing import Any

import numpy as np

from cj_objects import CityJSONFile


def load_geojson_icons(gj_path: Path):
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

    # Extract all points types and labels
    type_to_features = defaultdict(lambda: [])
    for feature in gj_data.get("features", []):
        attributes = feature["properties"]
        geometry = feature["geometry"]
        if geometry.get("type", "") != "Point":
            raise NotImplementedError(
                f"Only the 'Point' geometry is supported, not '{geometry.get("type", "")}"
            )
        feature_type = attributes["type"]
        if feature_type in ["fieldlab"]:
            continue
        type_to_features[feature_type].append(
            {"name": attributes["label"], "geom": geometry["coordinates"]}
        )

    pprint(type_to_features)


cj_file = CityJSONFile(
    scale=np.array([0.00001, 0.00001, 0.00001], dtype=np.float64),
    translate=np.array([0, 0, 0], dtype=np.float64),
)
