"""
The command line interface to run the different parts of the data pipeline.
Once installed, it all commands can be run with `uv run data-pipeline ...`.
More information about the CLI can be obtained with:

- `uv run data-pipeline --help`
- `uv run data-pipeline <command> --help`
"""

import logging
import subprocess
from pathlib import Path
from typing import Annotated, List, Mapping, Optional

import typer
from data_pipeline.cj_helpers.cj_attributes import (
    BdgAttr,
    BdgAttrReader,
    BdgPartAttr,
    BdgPartAttrReader,
    BdgRoomAttr,
    BdgRoomAttrReader,
    BdgStoreyAttr,
    BdgStoreyAttrReader,
)
from data_pipeline.cj_helpers.cj_objects import (
    Building,
    BuildingPart,
    BuildingRoom,
    BuildingStorey,
    CityJSONSpace,
)
from data_pipeline.cj_loading.cj_to_gltf import Cityjson2Gltf
from data_pipeline.cj_writing.bag_to_cj import Bag2Cityjson
from data_pipeline.cj_writing.gj_to_cj import load_geojson_icons
from data_pipeline.cj_writing.gltf_to_cj import (
    full_building_from_gltf,
    load_units_from_csv,
)
from data_pipeline.utils.codelists import format_codelist_json
from tqdm.contrib.logging import logging_redirect_tqdm

app = typer.Typer()


@app.command(
    "load_3dbag",
    help="Load 3DBAG geometries and combines it with given attributes to export a properly formatted CityJSON file.",
)
def load_3dbag(
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
            help="CSV path with the buildings subdivisions attributes.",
            exists=True,
        ),
    ] = None,
    overwrite: Annotated[
        bool,
        typer.Option(
            "-o",
            "--overwrite",
            help="Overwrite the output file if the file already exists.",
        ),
    ] = False,
    verbose: Annotated[
        int,
        typer.Option(
            "--verbose",
            "-v",
            count=True,
            help="How much information to provide during the execution of the script.",
        ),
    ] = 0,
):
    """
    Load 3DBAG geometries and combines it with given attributes to export a properly formatted CityJSON file.

    Parameters
    ----------
    input_cj_path : Path
        Input CityJSON file with 3DBAG data.
    output_cj_path : Path
        Output CityJSON path.
    bdgs_attr_path : Optional[Path], optional
        CSV path with the buildings attributes. By default None.
    bdgs_sub_attr_path : Optional[Path], optional
        CSV path with the buildings subdivisions attributes. By default None.
    overwrite : bool, optional
        Overwrite the output file if the file already exists. By default False.
    verbose : int, optional
        How much information to provide during the execution of the script. By default 0.

    Raises
    ------
    ValueError
        If the output path does not end with '.json'.
    RuntimeError
        If `overwrite` is set to False but the output path already exists.
    """
    if not output_cj_path.suffix == ".json":
        raise RuntimeError("The output path should end with '.json'")
    if output_cj_path.exists() and not overwrite:
        raise RuntimeError(
            f"There is already a file at {output_cj_path.absolute()}. Set `overwrite` to True to overwrite it."
        )

    setup_logging(verbose=verbose)
    with logging_redirect_tqdm():

        cj_bag_data = Bag2Cityjson(
            cj_path=input_cj_path,
            bdgs_attr_path=bdgs_attr_path,
            bdgs_sub_attr_path=bdgs_sub_attr_path,
        )
        cj_bag_data.export(output_cj_path)


@app.command(
    "load_custom_building",
    help="Load custom geometries from glTF and combines it with given attributes to export a properly formatted CityJSON file.",
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
            help="Path to buildings attributes in CSV format.",
            exists=True,
        ),
    ],
    parts_path: Annotated[
        Optional[Path],
        typer.Option(
            "-p",
            "--parts",
            help="Path to parts attributes in CSV format.",
            exists=True,
        ),
    ],
    storeys_path: Annotated[
        Optional[Path],
        typer.Option(
            "-s",
            "--storeys",
            help="Path to storeys attributes in CSV format.",
            exists=True,
        ),
    ],
    rooms_path: Annotated[
        Optional[Path],
        typer.Option(
            "-r",
            "--rooms",
            help="Path to rooms attributes in CSV format.",
            exists=True,
        ),
    ],
    units_path: Annotated[
        Optional[Path],
        typer.Option(
            "-u",
            "--units",
            help="Path to building units in CSV format.",
            exists=True,
        ),
    ],
    units_gltf_path: Annotated[
        Optional[Path],
        typer.Option(
            "-g",
            "--units_gltf",
            help="Path to building units in glTF format.",
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
    verbose: Annotated[
        int,
        typer.Option(
            "--verbose",
            "-v",
            count=True,
            help="How much information to provide during the execution of the script.",
        ),
    ] = 0,
):
    """
    Load and format the given glTF building into CityJSON by adding hierarchy, units and attributes at all level.

    Parameters
    ----------
    input_gltf_path : Path
        Input glTF file with building data and correct structure.
    output_cj_path : Path
        Output CityJSON path.
    buidlings_path : Path
        Path to buildings attributes in CSV format.
    parts_path : Path
        Path to parts attributes in CSV format.
    storeys_path : Path
        Path to storeys attributes in CSV format.
    rooms_path : Path
        Path to rooms attributes in CSV format.
    units_path : Path
        Path to building units in CSV format.
    units_gltf_path : Path
        Path to building units in glTF format.
    overwrite : bool, optional
        Overwrite the output file if the file already exists. By default False.
    verbose : int, optional
        How much information to provide during the execution of the script. By default 0.

    Raises
    ------
    ValueError
        If the input path does not end with '.glb' or '.gltf'.
    ValueError
        If the output path does not end with '.json'.
    ValueError
        If `overwrite` is set to False but the output path already exists.
    """
    if not input_gltf_path.suffix in [".glb", ".gltf"]:
        raise ValueError("The input path should end with '.glb' or '.gltf'.")
    if not output_cj_path.suffix == ".json":
        raise ValueError("The output path should end with '.json'.")
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
                BdgAttrReader(csv_path=buidlings_path).get_key_to_attr()
            )
        if parts_path is not None:
            all_attributes.append(
                BdgPartAttrReader(csv_path=parts_path).get_key_to_attr()
            )
        if storeys_path is not None:
            all_attributes.append(
                BdgStoreyAttrReader(csv_path=storeys_path).get_key_to_attr()
            )
        if rooms_path is not None:
            all_attributes.append(
                BdgRoomAttrReader(csv_path=rooms_path).get_key_to_attr()
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
                gltf_path=units_gltf_path,
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
    "load_outdoor",
    help="Load outdoor data from a GeoJSON file containing both the geometry and the attributes.",
)
def load_outdoor(
    input_gj_path: Annotated[
        Path,
        typer.Argument(
            help="Input GeoJSON file with the outdoor data.",
            exists=True,
        ),
    ],
    output_cj_path: Annotated[Path, typer.Argument(help="Output CityJSON path.")],
):
    """
    Load outdoor data from a GeoJSON file containing both the geometry and the attributes.

    Parameters
    ----------
    input_gj_path : Path
        Input GeoJSON file with the outdoor data.
    output_cj_path : Path
        Output CityJSON path.
    """
    load_geojson_icons(gj_path=input_gj_path, output_cj_path=output_cj_path)


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
    verbose: Annotated[
        int,
        typer.Option(
            "--verbose",
            "-v",
            count=True,
            help="How much information to provide during the execution of the script.",
        ),
    ] = 0,
):
    """
    Split a CityJSON file into a glTF file with the geometry and a CityJSON file with the attributes, both sharing the same identifiers and a similar structure.

    Parameters
    ----------
    input_cj_path : Path
        Input CityJSON file.
    output_folder_path : Path
        Output folder.
    overwrite : bool, optional
        Overwrite the content of the folder if files with the same names exist. By default False.
    verbose : int, optional
        How much information to provide during the execution of the script. By default 0.

    Raises
    ------
    RuntimeError
        If `overwrite` is set to False but the output folder already exists.
    """
    if output_folder_path.exists() and not overwrite:
        raise RuntimeError(
            f"Path '{output_folder_path.absolute()}' already exists but `overwrite` was set to False."
        )

    setup_logging(verbose=verbose)
    with logging_redirect_tqdm():
        output_folder_path.mkdir(parents=True, exist_ok=overwrite)

        cj_data = Cityjson2Gltf(input_cj_path)
        cj_data.make_gltf_scene()
        cj_data.export(output_folder_path, overwrite=overwrite)


@app.command(
    "subset_cj",
    help="Create a subset of a CityJSON file based on a list of identifiers in the file.",
)
def subset_cj(
    input_cj_path: Annotated[
        Path, typer.Argument(help="Input CityJSON path.", exists=True)
    ],
    output_cj_path: Annotated[Path, typer.Argument(help="Output CityJSON path.")],
    subset_txt_path: Annotated[
        Path,
        typer.Argument(
            help="Text path containing the object ids to keep, separated with new lines.",
        ),
    ],
):
    """
    Create a subset of a CityJSON file based on a list of identifiers in the file.

    Parameters
    ----------
    input_cj_path : Path
        Input CityJSON path.
    output_cj_path : Path
        Output CityJSON path.
    subset_txt_path : Path
        Text path containing the object ids to keep, separated with new lines.

    Raises
    ------
    ValueError
        If the input path does not end with '.json'.
    ValueError
        If the output path does not end with '.json'.
    """
    if not input_cj_path.suffix == ".json":
        raise ValueError("The input path should end with '.json'")
    if not output_cj_path.suffix == ".json":
        raise ValueError("The output path should end with '.json'")

    command = ["cjio", str(input_cj_path.absolute()), "subset"]
    with open(subset_txt_path) as f:
        for obj_key_line in f.readlines():
            obj_key = obj_key_line.strip()
            command.extend(["--id", obj_key])
    command.extend(["save", str(output_cj_path.absolute())])
    subprocess.run(command)


@app.command(
    "format_codelist",
    help="Format the codelist for the units from a CSV input into a JSON file.",
)
def format_codelist(
    input_csv_path: Annotated[
        Path, typer.Argument(help="Input CSV file.", exists=True)
    ],
    output_json_path: Annotated[Path, typer.Argument(help="Output JSON path.")],
    overwrite: Annotated[
        bool,
        typer.Option(
            "-o",
            "--overwrite",
            help="Overwrite the output file if the file already exists.",
        ),
    ] = False,
):
    """
    Format the codelist for the units from a CSV input into a JSON file.

    Parameters
    ----------
    input_csv_path : Path
        Input CSV file.
    output_json_path : Path
        Output JSON path.
    overwrite : bool, optional
        Overwrite the output file if it already exists. By default False.

    Raises
    ------
    ValueError
        If the input path does not end with '.csv'.
    ValueError
        If the output path does not end with '.json'.
    ValueError
        If `overwrite` is set to False but the output path already exists.
    """
    if not input_csv_path.suffix == ".csv":
        raise ValueError("The input path should end with '.csv'")
    if not output_json_path.suffix == ".json":
        raise ValueError("The output path should end with '.json'")
    if output_json_path.exists() and not overwrite:
        raise ValueError(
            f"There is already a file at {output_json_path.absolute()}. Set `overwrite` to True to overwrite it."
        )

    format_codelist_json(
        input_csv_path=input_csv_path, output_json_path=output_json_path
    )


def setup_logging(verbose: int):
    """
    Utility function to set up the logging parameters properly.

    Parameters
    ----------
    verbose : int
        Integer indicating how much information to display.
        Possible values are 0 (ERROR), 1 (WARNING), 2 (INFO) and 3 (DEBUG)

    Raises
    ------
    RuntimeError
        If `verbose` is not one of the expected values.
    """
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
