# Run from the repo's python folder:  .\run_pipeline.ps1
$i='../threejs/assets/processing_input'; $o='../threejs/assets/processing_output'; $a="$i/attributes"; $c="$i/custom_geometry"
uv run data-pipeline load_3dbag "$i/bag_geometry/subset.city.json" "$o/3dbag.city.json" -b "$a/buildings.csv" -s "$a/subdivisions.csv" --overwrite
uv run data-pipeline load_custom_building "$c/08.glb" "$o/08.city.json" -b "$a/buildings.csv" -p "$a/parts.csv" -s "$a/storeys.csv" -r "$a/rooms.csv" -u "$a/units.csv" -g "$c/08-navigation_elements.glb" --overwrite
uv run data-pipeline load_custom_building "$c/66.glb" "$o/66.city.json" -b "$a/buildings.csv" -p "$a/parts.csv" -s "$a/storeys.csv" -r "$a/rooms.csv" -u "$a/units_66.csv" -g "$c/66.glb" --overwrite
Push-Location $o
uv run --project ../../../python cjio 08.city.json merge 66.city.json merge 3dbag.city.json merge outdoor.city.json save all_buildings.city.json
Pop-Location
uv run data-pipeline split_cj "$o/all_buildings.city.json" ../threejs/assets/threejs/buildings --overwrite
