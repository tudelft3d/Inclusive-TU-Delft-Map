import csv
import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np
import trimesh
from numpy.typing import NDArray
from tqdm import tqdm

from cj_geometry import MultiSurface
from cj_loader import CityjsonLoader, cj_object_to_mesh
from cj_objects import (
    Building,
    BuildingPart,
    CityJSONFile,
    CityJSONObject,
    CityJSONObjectSubclass,
)
from geometry_utils import merge_trimeshes, orient_polygons_z_up


def process_bag_geoms(
    cj_objects: dict[str, dict[str, Any]],
    vertices: NDArray[np.float64],
    bag_2d_ids: list[str],
) -> tuple[list[MultiSurface], list[str]]:
    # Extract the ids of all the BAG buidlings that constitue this building
    bag_3d_ids = []

    if len(bag_2d_ids) == 0:
        return [], []

    # Load all the geometries as Trimesh
    all_meshes: dict[int, list[trimesh.Trimesh]] = {0: [], 1: [], 2: []}
    for bag_2d_id in bag_2d_ids:
        # Extract LoD 0 geometry
        bag_2d = cj_objects[bag_2d_id]
        meshes_lods = cj_object_to_mesh(obj_dict=bag_2d, vertices=vertices)
        if meshes_lods is None:
            raise RuntimeError(
                f"An object without geometry is unexpected in the 3D BAG."
            )
        all_meshes[0].append(meshes_lods["0"])

        # Process the children
        for bag_3d_id in bag_2d["children"]:
            bag_3d_ids.append(bag_3d_id)
            obj_3d = cj_objects[bag_3d_id]
            meshes_lods = cj_object_to_mesh(obj_dict=obj_3d, vertices=vertices)
            if meshes_lods is None:
                raise RuntimeError(
                    f"An object without geometry is unexpected in the 3D BAG."
                )
            all_meshes[1].append(meshes_lods["1.3"])
            all_meshes[2].append(meshes_lods["2.2"])

    # Merge all the meshes at the same LoD
    final_meshes: dict[int, trimesh.Trimesh] = {}
    for lod, meshes in all_meshes.items():
        full_mesh = merge_trimeshes(meshes=meshes, fix_geometry=True)
        final_meshes[lod] = full_mesh

    all_geoms = []

    # # Add LoD 0 geometry
    #
    # lod_0_mesh = flatten_trimesh(final_meshes[1])
    # all_geoms.append(MultiSurface.from_mesh(lod=0, mesh=lod_0_mesh))

    # Add the other geoms
    orient_polygons_z_up(final_meshes[0])
    all_geoms.append(MultiSurface.from_mesh(lod=0, mesh=final_meshes[0]))
    all_geoms.append(MultiSurface.from_mesh(lod=1, mesh=final_meshes[1]))
    all_geoms.append(MultiSurface.from_mesh(lod=2, mesh=final_meshes[2]))

    return (all_geoms, bag_2d_ids + bag_3d_ids)


class Bag2Cityjson(CityjsonLoader):

    def __init__(
        self,
        cj_path: Path,
        bdgs_attr_path: Optional[Path],
        bdgs_sub_attr_path: Optional[Path],
        bag_column: Optional[str],
        id_column: Optional[str],
        skip_column: Optional[str],
        parent_column: Optional[str],
    ) -> None:
        super().__init__(cj_path)

        self.cj_file = self._connect_buildings_attributes(
            bdgs_attr_path=bdgs_attr_path,
            bdgs_sub_attr_path=bdgs_sub_attr_path,
            bag_column=bag_column,
            id_column=id_column,
            skip_column=skip_column,
            parent_column=parent_column,
        )

    def _connect_buildings_attributes(
        self,
        bdgs_attr_path: Optional[Path],
        bdgs_sub_attr_path: Optional[Path],
        bag_column: Optional[str],
        id_column: Optional[str],
        skip_column: Optional[str],
        parent_column: Optional[str],
    ) -> CityJSONFile:
        if bdgs_attr_path is None and bdgs_sub_attr_path is not None:
            raise ValueError(
                "When attributes are given for the buildings subdivisions, attributes must be given for the buildings."
            )
        if bdgs_attr_path is not None:
            if bag_column is None or id_column is None or skip_column is None:
                raise ValueError(
                    "When there are attributes to attach to the objects, 'bag_column', 'id_column' and 'skip_column' should be specified."
                )
        if bdgs_sub_attr_path is not None:
            if parent_column is None:
                raise ValueError(
                    "When there are attributes to attach to the buildings subdivisions, 'parent_column' should be specified."
                )

        # Used to remember which 3D BAG buildings have already been processed
        unprocessed_bag_ids: set[str] = set(self.data["CityObjects"].keys())

        # Initialise CityJSON objects lists
        all_objects_cj: dict[str, CityJSONObjectSubclass] = {}

        def _process_bag_element(
            obj_id: str,
            bag_ids: list[str],
            unprocessed_bag_ids: set[str] | None = None,
            skip: bool = False,
        ) -> list[MultiSurface] | None:
            logging.log(logging.DEBUG, f"Processing {obj_id}")

            # Check if the key is already used
            if obj_id in all_objects_cj.keys():
                raise RuntimeError(
                    f"Object id {obj_id} already corresponds to another building."
                )

            # Skip the building if using custom geometry instead
            if skip:
                if unprocessed_bag_ids is not None:
                    unprocessed_bag_ids -= set(bag_ids)
                return

            all_geoms, processed_bag_ids = process_bag_geoms(
                cj_objects=self.data["CityObjects"],
                vertices=self.vertices,
                bag_2d_ids=bag_ids,
            )

            # Update the list of unprocessed bag ids
            if unprocessed_bag_ids is not None:
                unprocessed_bag_ids -= set(processed_bag_ids)

            return all_geoms

        # Load the buildings attributes
        if bdgs_attr_path is None:
            bdgs_reader = []
        else:
            with open(bdgs_attr_path, "r", encoding="utf-8-sig") as csvfile:
                bdgs_reader = list(csv.DictReader(csvfile, delimiter=";"))
            # Check that the columns are valid
            if len(bdgs_reader) > 0:
                row0 = bdgs_reader[0]
                for col in [bag_column, id_column, skip_column]:
                    if bag_column not in row0.keys():
                        raise ValueError(
                            f"The column {col} is not in the buildings attributes."
                        )

        # Load the buildings subdivisions attributes
        if bdgs_sub_attr_path is None:
            bdgs_sub_reader = []
        else:
            with open(bdgs_sub_attr_path, encoding="utf-8-sig") as csvfile:
                bdgs_sub_reader = list(csv.DictReader(csvfile, delimiter=";"))
            # Check that the columns are valid
            if len(bdgs_sub_reader) > 0:
                row0 = bdgs_sub_reader[0]
                for col in [bag_column, id_column, skip_column, parent_column]:
                    if bag_column not in row0.keys():
                        raise ValueError(
                            f"The column {col} is not in the buildings attributes."
                        )

        # Iterate over the buildings
        for row in tqdm(bdgs_reader, desc="Processing the buildings with attributes"):
            # Get the object id
            obj_id = row[id_column]

            # Extract the ids of all the BAG buildings that constitue this building
            all_bag_ids = row[bag_column].split(",") if row[bag_column] != "" else []

            skip = row[skip_column] != ""

            geoms = _process_bag_element(
                obj_id=obj_id,
                bag_ids=all_bag_ids,
                unprocessed_bag_ids=unprocessed_bag_ids,
                skip=skip,
            )

            if geoms is not None:
                obj_id_hyphens = obj_id.replace(".", "-")
                building = Building(object_id=obj_id_hyphens, geometries=geoms)
                building.add_attributes(row)
                all_objects_cj[obj_id_hyphens] = building

        for row in tqdm(
            bdgs_sub_reader, desc="Processing the sub-buildings with attributes"
        ):
            # Get the object and parent id
            parent_id = row[parent_column]
            obj_id = parent_id + "." + row[id_column]

            # Extract the ids of all the BAG buidlings that constitue this building
            all_bag_ids = row[bag_column].split(",") if row[bag_column] != "" else []

            skip = row[skip_column] != ""

            geoms = _process_bag_element(
                obj_id=obj_id,
                bag_ids=all_bag_ids,
                unprocessed_bag_ids=unprocessed_bag_ids,
                skip=skip,
            )

            if geoms is not None:
                obj_id_hyphens = obj_id.replace(".", "-")
                subdivision = BuildingPart(object_id=obj_id_hyphens, geometries=geoms)
                subdivision.add_attributes(row)
                all_objects_cj[obj_id_hyphens] = subdivision
                # Connect to the parent Building
                parent_id_hyphens = parent_id.replace(".", "-")
                parent_obj = all_objects_cj[parent_id_hyphens]
                CityJSONObject.add_parent_child(parent=parent_obj, child=subdivision)

        # Add the remaining buildings
        for bag_2d_id in tqdm(
            unprocessed_bag_ids, desc="Processing the remaining buildings"
        ):
            # Skip the children
            if bag_2d_id[-2] == "-":
                continue

            geoms = _process_bag_element(
                obj_id=bag_2d_id,
                bag_ids=[bag_2d_id],
            )

            if geoms is not None:
                bag_2d_id_hyphens = bag_2d_id.replace(".", "-")
                building = Building(object_id=obj_id_hyphens, geometries=geoms)
                all_objects_cj[bag_2d_id_hyphens] = building

        cj_file = CityJSONFile(
            scale=np.array([0.00001, 0.00001, 0.00001], dtype=np.float64),
            translate=np.array([0, 0, 0], dtype=np.float64),
        )
        cj_file.add_cityjson_objects(all_objects_cj.values())

        return cj_file

    def export(self, output_cj_path: Path) -> None:
        # Check the correctness of the hierarchy
        self.cj_file.check_objects_hierarchy()

        # Write to CityJSON
        output_cj_path.parent.mkdir(parents=True, exist_ok=True)
        file_json = self.cj_file.to_json()
        with open(output_cj_path, "w") as f:
            f.write(file_json)
