# Data Pipeline

The data pipeline can be split between two phases:

1. Format and combine the geometry and the attributes into CityJSON with a common structure.
2. Import everything in the database.
3. Export everything from the database.
4. Format into convenient formats for three.js.

## Prerequisites

To be able to run the commands mentioned below, you first need to install the Python environment. See the [specific README](src/README.md) for more information.

Anything related to the database also requires to have set up the 3D City DB instance.
See the [specific README](database/README.md) for more information.

To learn more about the data structure and conventions used in this project, please read [this document](./Data_structure.md).

## Explanations

### Data Processing

There are two main sources for the geometry:

- The 3DBAG which provides outer shells for the buildings.
  These files are expected to be in CityJSON format.
- The custom geometry which contains buildings outer shells but also potentially building parts, storeys and rooms.
  These files are expected to be in glTF format.

Both sources are expected to have coordinates following EPSG:7415.
However, there are two different scripts that allow to format them in a similar and consistent CityJSON output that can then be loaded into the database.

#### 3DBAG

The command to load 3DBAG data is `load_3dbag` from `cli.py`.
Since the 3DBAG only contains the outer shells of the buildings, the command can take attributes about the buildings and buildings' subdivisions.
A number of columns need to be present in the attributes to be able to group 3DBAG objects together, assign them a new identifier, and skip buildings that come from other sources.

Here is an example of running the command:

```bash
# From src/
uv run python cli.py load_3dbag \
    <input_cityjson> \
    <output_cityjson> \
    -b <csv_buildings_attributes_path> \
    -s <csv_buildings_subdivisions_attributes_path> \
    --bag <csv_column_bag_ids> \
    --id <csv_column_final_id> \
    --skip <csv_column_skip> \
    --parent <csv_column_parent_final_id>
```

#### Custom Geometry

The command to load the custom geometry is `load_custom_building` from `cli.py`.
Since the custom geometry is expected to have been processed for this project, there are more requirements on the expected format.
The expected input must be glTF, but the hierarchy of the scene does not matter, only the identifiers of the objects are important.
The glTF file is not expected to have attributes (they will be ignore if there are any), as the attributes are joined from one or multiple CSV files.
However, every object identifier should have a name following this convention: `<object_unique_id>.lod_<lod>` where:

- `<object_unique_id>` must be:
    - `<Building>` for a building,
    - `<Building>.<Part>` for a building part,
    - `<Building>.<Part>.<Storey>` for a storey,
    - `<Building>.<Part>.<Storey>.<Room>` for a room.
- `<lod>` is the level of detail, which can only be 0, 1, 2 or 3.

So the outer shell of a building could be `08.lod_2` while the 2D footprint of a room in the same building could be `08.02.00.600.lod_0`.
The loader automatically builds a hierarchy based on this numbering, and assigns the right types to each object.
It also automatically creates the intermediate levels if they do not exist (so it is not a problem if there is no `08.02.lod_<lod>` in the file).

Finally, to add attributes to the geometry CSV files are once again expected.
The link with the geometry will be made based on their `<object_unique_id>` (without `.lod_<lod>`) in the glTF and in the speficied column from the CSV file.

Here is an example of running the command:

```bash
# From src/
uv run python cli.py load_custom_building \
    <input_glb> \
    <output_cityjson> \
    -a <csv_attribues_path_0> \
    -c <csv_id_column_0> \
    -a <csv_attribues_path_1> \
    -c <csv_id_column_1>
```

### Database Import

Since there are different source of data, you might have multiple CityJSON files to import into the database.
To do so, we use the `import cityjson` command provided by 3D City DB.
You can find more information about this command on the [official documentation](https://docs.3dcitydb.org/1.1/citydb-tool/import-cityjson/).

The simplest command to import everything is the following:

```bash
# From database/
./citydb-tool-1.1.0/citydb import cityjson \
    -H <host> \
    -P <port> \
    -d <database> \
    -u <user> \
    <cityjson_files>
```

where `<cityjson_files>` is the list of CityJSON files to import, separated with spaces.

### Database Export

To export the data from the database, we use the `export cityjson` command provided by 3D City DB.
You can find more information about this command on the [official documentation](https://docs.3dcitydb.org/1.1/citydb-tool/export-cityjson/).

Here is an example showing how to export everything in one file:

```bash
# From database/
./citydb-tool-1.1.0/citydb export cityjson \
    -H <host> \
    -P <port> \
    -d <database> \
    -u <user> \
    -o <cityjson_output> \
    --no-json-lines \
    --vertex-precision 3
```

where:

- `<cityjson_output>` is the path to the unique CityJSON output
- `--no-json-lines` specify to use the defulat CityJSON format instead of [CityJSON Text Sequences](https://www.cityjson.org/cityjsonseq/).
    If the data to export is too large, you might want to remove this argument as it results in having to load everything in memory at once.
- `--vertex-precision 3` sets the precision of the coordinates.
    Since the coordinates are in meters in the Dutch CRS, a value of 3 corresponds to a millimeter precision.

### Split into glTF + CityJSON

To split the content of a CityJSON file into the geometry in glTF and the attributes in CityJSON, we use the command `split_cj` from `cli.py`.
The resulting glTF and CityJSON both store the structure of the file, with the same identifiers to be able to link them together.

You can simply call it like this:

```bash
# From src/
uv run python cli.py split_cj <cityjson_input> <folder_output>
```

## Example

### Without the database

1. Go to `src`:

    ```bash
    cd src
    ```

2. Process 3DBAG data:

    ```bash
    uv run python cli.py load_3dbag \
        ../threejs/assets/processing_input/bag_geometry/subset.city.json \
        ../threejs/assets/processing_output/3dbag.city.json \
        -b ../threejs/assets/processing_input/attributes/buildings.csv \
        -s ../threejs/assets/processing_input/attributes/subdivisions.csv \
        --overwrite \
        -vv
    ```

3. Process custom geometry:

    ```bash
    uv run python cli.py load_custom_building \
        ../threejs/assets/processing_input/custom_geometry/08.glb \
        ../threejs/assets/processing_output/08.city.json \
        -b ../threejs/assets/processing_input/attributes/buildings.csv \
        -p ../threejs/assets/processing_input/attributes/parts.csv \
        -s ../threejs/assets/processing_input/attributes/storeys.csv \
        -r ../threejs/assets/processing_input/attributes/rooms.csv \
        -u ../threejs/assets/processing_input/attributes/units.csv \
        --units_gltf ../threejs/assets/processing_input/custom_geometry/08-navigation_elements.glb \
        --overwrite \
        -vv
    ```

4. Process the outdoor icons:

    ```bash
    uv run python cli.py load_gj_icons \
        ../threejs/assets/processing_input/all_outdoor_objects.geojson \
        ../threejs/assets/processing_output/outdoor.city.json
    ```

5. Merge them together:

    ```bash
    uv run cjio ../threejs/assets/processing_output/08.city.json \
        merge ../threejs/assets/processing_output/3dbag.city.json \
        merge ../threejs/assets/processing_output/outdoor.city.json \
        save  ../threejs/assets/processing_output/all_buildings.city.json
    ```

6. Split into CityJSON and glTF used by the map:

    ```bash
    uv run python cli.py split_cj \
        ../threejs/assets/processing_output/all_buildings.city.json \
        ../threejs/assets/threejs/buildings \
        --overwrite \
        -vv
    ```

### With the database

The current pipeline looks like this:

1. Go to `src`:

    ```bash
    cd src
    ```

2. Process 3DBAG data:

    ```bash
    uv run python cli.py load_3dbag ../threejs/assets/processing_input/bag_geometry/subset.city.json ../threejs/assets/processing_output/3dbag.city.json -b ../threejs/assets/processing_input/attributes/buildings.csv -s ../threejs/assets/processing_input/attributes/subdivisions.csv --bag "3D BAG Buildings IDs (list,)" --id "Final Number" --skip "Skip" --parent "Parent Final Number"
    ```

3. Process custom geometry:

    ```bash
    uv run python cli.py load_custom_building ../threejs/assets/processing_input/custom_geometry/08.glb ../threejs/assets/processing_output/08.city.json -u ../threejs/assets/processing_input/attributes/units.csv --units-code-column "Type Code [str]" --units-spaces-column "Numbers [list,str]" -a ../threejs/assets/processing_input/attributes/rooms.csv -c "Number [str]" -a ../threejs/assets/processing_input/attributes/buildings.csv -c "Number [str]"
    ```

4. Prepare the database arguments:

    ```bash
    source ../database/citydb-tool-1.1.0/3dcitydb/postgresql/shell-scripts/unix/connection-details.sh
    ```

5. Import everything into the database:

    ```bash
    ../database/citydb-tool-1.1.0/citydb import cityjson -H "$PGHOST" -P "$PGPORT" -d "$CITYDB" -u "$PGUSER" ../threejs/assets/processing_output/3dbag.city.json ../threejs/assets/processing_output/08.city.json
    ```

6. Export everything from the database:

    ```bash
    ../database/citydb-tool-1.1.0/citydb export cityjson -H "$PGHOST" -P "$PGPORT" -d "$CITYDB" -u "$PGUSER" -o ../threejs/assets/processing_output/all_buildings.city.json --no-json-lines --vertex-precision 3
    ```

7. Split into CityJSON and glTF used by the map:

    ```bash
    uv run python cli.py split_cj ../threejs/assets/processing_output/all_buildings.city.json ../threejs/assets/threejs/buildings --overwrite
    ```
