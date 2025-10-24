import logging
import subprocess
from pathlib import Path
from typing import Annotated, List, Mapping, Optional

import typer

from bag_to_cj import Bag2Cityjson
from cj_attributes import (
    BdgAttr,
    BdgAttrReader,
    BdgPartAttr,
    BdgPartAttrReader,
    BdgRoomAttr,
    BdgRoomAttrReader,
    BdgStoreyAttr,
    BdgStoreyAttrReader,
)
from cj_objects import (
    Building,
    BuildingPart,
    BuildingRoom,
    BuildingStorey,
    CityJSONSpace,
)
from cj_to_gltf import Cityjson2Gltf
from gltf_to_cj import full_building_from_gltf, load_units_from_csv

app = typer.Typer()
from tqdm.contrib.logging import logging_redirect_tqdm

from gj_to_cj import load_geojson_icons


@app.command(
    "split_cj",
    help="Split a CityJSON file into a glTF file with the geometry and a CityJSON file with the attributes, both sharing the same identifiers and a similar structure.",
)
def split_cj(
    input_cj_path: Annotated[
        Path, typer.Argument(help="Input CityJSON file", exists=True)
    ],
    output_folder_path: Annotated[Path, typer.Argument(help="Output folder")],
    overwrite: Annotated[
        bool,
        typer.Option(
            "-o",
            "--overwrite",
            help="Overwrite the content of the folder if files with the same names exist.",
        ),
    ] = False,
    verbose: Annotated[int, typer.Option("--verbose", "-v", count=True)] = 0,
):
    if output_folder_path.exists() and not overwrite:
        raise RuntimeError(
            f"Path '{output_folder_path}' already exists but `overwrite` was set to False."
        )

    setup_logging(verbose=verbose)
    with logging_redirect_tqdm():
        output_folder_path.mkdir(parents=True, exist_ok=overwrite)

        cj_data = Cityjson2Gltf(input_cj_path)
        cj_data.make_gltf_scene()
        cj_data.export(output_folder_path, overwrite=overwrite)


@app.command(
    "load_3dbag",
    help="Load 3DBAG geometries and combines it with given attributes to export a properly formatted CityJSON file to feed the database.",
)
def load_bag(
    input_cj_path: Annotated[
        Path, typer.Argument(help="Input CityJSON file with 3DBAG data.", exists=True)
    ],
    output_cj_path: Annotated[Path, typer.Argument(help="Output CityJSON path.")],
    bdgs_attr_path: Annotated[
        Optional[Path],
        typer.Option(
            "-b",
            "--buildings",
            help="CSV path with the buildings attributes.",
            exists=True,
        ),
    ] = None,
    bdgs_sub_attr_path: Annotated[
        Optional[Path],
        typer.Option(
            "-s",
            "--subdivisions",
            help="CSV with the buildings subdivisions attributes.",
            exists=True,
        ),
    ] = None,
    # bag_column: Annotated[
    #     Optional[str],
    #     typer.Option(
    #         "--bag",
    #         help="The CSV column that specifies which 3DBAG entities are part of the building/building subdivision.",
    #     ),
    # ] = None,
    # id_column: Annotated[
    #     Optional[str],
    #     typer.Option(
    #         "--id",
    #         help="The CSV column that specifies the id to use for the exported building/building subdivision.",
    #     ),
    # ] = None,
    # skip_column: Annotated[
    #     Optional[str],
    #     typer.Option(
    #         "--skip",
    #         help="The CSV column that specifies whether to skip this building/building subdivision. Useful for objects with custom geometry to avoid duplicates.",
    #     ),
    # ] = None,
    # parent_column: Annotated[
    #     Optional[str],
    #     typer.Option(
    #         "--parent",
    #         help="The CSV column that specifies the parent of this building subdivision, referring to the id_column of the buildings attributes.",
    #     ),
    # ] = None,
    overwrite: Annotated[
        bool,
        typer.Option(
            "-o",
            "--overwrite",
            help="Overwrite the output file if the file already exists.",
        ),
    ] = False,
    verbose: Annotated[int, typer.Option("--verbose", "-v", count=True)] = 0,
):
    if output_cj_path.exists() and not overwrite:
        raise ValueError(
            f"There is already a file at {output_cj_path.absolute()}. Set `overwrite` to True to overwrite it."
        )

    setup_logging(verbose=verbose)
    with logging_redirect_tqdm():
        if not output_cj_path.suffix == ".json":
            raise ValueError("The output path should end with '.json'")

        cj_bag_data = Bag2Cityjson(
            cj_path=input_cj_path,
            bdgs_attr_path=bdgs_attr_path,
            bdgs_sub_attr_path=bdgs_sub_attr_path,
            # bag_column=bag_column,
            # id_column=id_column,
            # skip_column=skip_column,
            # parent_column=parent_column,
        )
        cj_bag_data.export(output_cj_path)


@app.command(
    "load_custom_building",
    help="Load custom geometries from glTF and combines it with given attributes to export a properly formatted CityJSON file to feed the database.",
)
def load_custom_building(
    input_gltf_path: Annotated[
        Path,
        typer.Argument(
            help="Input glTF file with building data and correct structure.",
            exists=True,
        ),
    ],
    output_cj_path: Annotated[Path, typer.Argument(help="Output CityJSON path.")],
    buidlings_path: Annotated[
        Optional[Path],
        typer.Option(
            "-b",
            "--buildings",
            help="Paths to buildings attributes in CSV format.",
            exists=True,
        ),
    ],
    parts_path: Annotated[
        Optional[Path],
        typer.Option(
            "-p",
            "--parts",
            help="Paths to parts attributes in CSV format.",
            exists=True,
        ),
    ],
    storeys_path: Annotated[
        Optional[Path],
        typer.Option(
            "-s",
            "--storeys",
            help="Paths to storeys attributes in CSV format.",
            exists=True,
        ),
    ],
    rooms_path: Annotated[
        Optional[Path],
        typer.Option(
            "-r",
            "--rooms",
            help="Paths to rooms attributes in CSV format.",
            exists=True,
        ),
    ],
    units_path: Annotated[
        Optional[Path],
        typer.Option(
            "-u",
            "--units",
            help="Paths to building units in CSV format.",
            exists=True,
        ),
    ],
    overwrite: Annotated[
        bool,
        typer.Option(
            "-o",
            "--overwrite",
            help="Overwrite the output file if the file already exists.",
        ),
    ] = False,
    verbose: Annotated[int, typer.Option("--verbose", "-v", count=True)] = 0,
):
    if not input_gltf_path.suffix in [".glb", ".gltf"]:
        raise ValueError("The input path should end with '.glb' or '.gltf'.")
    if not output_cj_path.suffix == ".json":
        raise ValueError("The output path should end with '.json'.")
    # if len(attributes_paths) != len(attributes_id_cols):
    #     raise ValueError(
    #         "The arguments `attributes_paths` and `attributes_id_cols` should have the same number of elements."
    #     )

    if output_cj_path.exists() and not overwrite:
        raise ValueError(
            f"There is already a file at {output_cj_path.absolute()}. Set `overwrite` to True to overwrite it."
        )

    setup_logging(verbose=verbose)
    with logging_redirect_tqdm():
        # Load the geometry from glTF
        cj_file = full_building_from_gltf(gltf_path=input_gltf_path)

        logging.info("Load the CSV attributes...")

        all_attributes: list[
            Mapping[str, BdgAttr | BdgPartAttr | BdgStoreyAttr | BdgRoomAttr]
        ] = []
        if buidlings_path is not None:
            all_attributes.append(
                BdgAttrReader(csv_path=buidlings_path).get_id_to_attr()
            )
        if parts_path is not None:
            all_attributes.append(
                BdgPartAttrReader(csv_path=parts_path).get_id_to_attr()
            )
        if storeys_path is not None:
            all_attributes.append(
                BdgStoreyAttrReader(csv_path=storeys_path).get_id_to_attr()
            )
        if rooms_path is not None:
            all_attributes.append(
                BdgRoomAttrReader(csv_path=rooms_path).get_id_to_attr()
            )

        logging.info("Add the attributes to the spaces...")

        # Add the attributes to the CityJSON spaces
        for city_object in cj_file.city_objects:
            if isinstance(city_object, CityJSONSpace):
                for attributes in all_attributes:
                    if city_object.space_id not in attributes:
                        continue
                    attr = attributes[city_object.space_id]
                    if isinstance(city_object, Building) and isinstance(attr, BdgAttr):
                        city_object.apply_attr(attr, overwrite=True)
                    if isinstance(city_object, BuildingPart) and isinstance(
                        attr, BdgPartAttr
                    ):
                        city_object.apply_attr(attr, overwrite=True)
                    if isinstance(city_object, BuildingStorey) and isinstance(
                        attr, BdgStoreyAttr
                    ):
                        city_object.apply_attr(attr, overwrite=True)
                    if isinstance(city_object, BuildingRoom) and isinstance(
                        attr, BdgRoomAttr
                    ):
                        city_object.apply_attr(attr, overwrite=True)

        logging.info("Load the units...")

        # Load the units
        if units_path is not None:
            load_units_from_csv(
                cj_file=cj_file,
                csv_path=units_path,
                # code_column=units_code_column,
                # spaces_column=units_spaces_column,
            )

        logging.info("Check the hierarchy...")

        # Check the correctness of the hierarchy
        cj_file.check_objects_hierarchy(n_components=2)

        logging.info("Write the file...")

        # Write to CityJSON
        file_json = cj_file.to_json()
        output_cj_path.parent.mkdir(parents=True, exist_ok=True)
        with open(Path(output_cj_path), "w") as f:
            f.write(file_json)


@app.command(
    "load_gj_icons",
    help="Load custom geometries from glTF and combines it with given attributes to export a properly formatted CityJSON file to feed the database.",
)
def load_gj_icons(
    input_gj_path: Annotated[
        Path,
        typer.Argument(
            help="Input GeoJSON file with icons.",
            exists=True,
        ),
    ],
    output_cj_path: Annotated[Path, typer.Argument(help="Output CityJSON path.")],
):
    load_geojson_icons(gj_path=input_gj_path, output_cj_path=output_cj_path)


@app.command(
    "subset_cj",
    help="Create a subset of a CityJSON file based on a list of identifiers in the file.",
)
def subset_cj(
    input_cj_path: Annotated[
        Path, typer.Argument(help="Input CityJSON file.", exists=True)
    ],
    output_cj_path: Annotated[Path, typer.Argument(help="Output CityJSON path.")],
    subset: Annotated[
        List[str],
        typer.Argument(
            help="Object ids to keep, separated with spaces.",
        ),
    ],
):
    if not input_cj_path.suffix == ".json":
        raise ValueError("The input path should end with '.json'")
    if not output_cj_path.suffix == ".json":
        raise ValueError("The output path should end with '.json'")

    command = ["cjio", str(input_cj_path.absolute()), "subset"]
    for obj_id in subset:
        command.extend(["--id", obj_id])
    command.extend(["save", str(output_cj_path.absolute())])
    subprocess.run(command)


def setup_logging(verbose: int):
    match verbose:
        case 0:
            log_level = logging.ERROR
        case 1:
            log_level = logging.WARNING
        case 2:
            log_level = logging.INFO
        case 3:
            log_level = logging.DEBUG
        case _:
            raise RuntimeError(
                f"Verbose values can only go from 0 to 3 (nothing, '-v', '-vv' or '-vvv')."
            )
    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(levelname)s - %(message)s",
    )


if __name__ == "__main__":
    app()
