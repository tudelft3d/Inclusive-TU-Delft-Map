"""
Scripts to load 3DBAG building shells and export them to CityJSON after adding custom attributes.
"""

import logging
from pathlib import Path
from typing import Any, Optional

import numpy as np
import trimesh
from data_pipeline.cj_helpers.cj_attributes import (
    BdgAttr,
    BdgAttrReader,
    BdgSubAttr,
    BdgSubAttrReader,
)
from data_pipeline.cj_helpers.cj_geometry import MultiSurface
from data_pipeline.cj_helpers.cj_objects import (
    Building,
    BuildingPart,
    BuildingUnit,
    BuildingUnitContainer,
    CityJSONFile,
    CityJSONObject,
    CityJSONObjectSubclass,
    CityJSONSpace,
    CityJSONSpaceSubclass,
)
from data_pipeline.cj_loading.cj_loader import CityjsonLoader, cj_object_to_mesh
from data_pipeline.utils.geometry_utils import merge_trimeshes, orient_polygons_z_up
from numpy.typing import NDArray
from tqdm import tqdm


def process_bag_geoms(
    cj_objects: dict[str, dict[str, Any]],
    vertices: NDArray[np.float64],
    bag_2d_ids: list[str],
) -> tuple[list[MultiSurface], list[str]]:
    """
    Process the geometry of multiple CityJSON objects and combines them into one mesh, for each LoD.

    Parameters
    ----------
    cj_objects : dict[str, dict[str, Any]]
        The input CityJSON file as a dictionary.
    vertices : NDArray[np.float64]
        The vertices correctly transformed to their actual coordinates.
    bag_2d_ids : list[str]
        The IDs of the objects to extract from `cj_objects` and to combine into one mesh.

    Returns
    -------
    list[MultiSurface]
        All the geometries.
    list[str]
        All the IDs from 3DBAG that were included in the geometry.

    Raises
    ------
    RuntimeError
        If an object from `cj_objects` has no geometry, which is not expected from the
        3DBAG.
    """
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
                f"An object without geometry is unexpected in the 3DBAG."
            )
        all_meshes[0].append(meshes_lods["0"])

        # Process the children
        for bag_3d_id in bag_2d["children"]:
            bag_3d_ids.append(bag_3d_id)
            obj_3d = cj_objects[bag_3d_id]
            meshes_lods = cj_object_to_mesh(obj_dict=obj_3d, vertices=vertices)
            if meshes_lods is None:
                raise RuntimeError(
                    f"An object without geometry is unexpected in the 3DBAG."
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
    """
    Class to process the 3DBAG building shells and combine them with attributes.
    """

    def __init__(
        self,
        cj_path: Path,
        bdgs_attr_path: Optional[Path],
        bdgs_sub_attr_path: Optional[Path],
    ) -> None:
        super().__init__(cj_path)

        self.cj_file = self._connect_buildings_attributes(
            bdgs_attr_path=bdgs_attr_path,
            bdgs_sub_attr_path=bdgs_sub_attr_path,
        )

    def _connect_buildings_attributes(
        self,
        bdgs_attr_path: Optional[Path],
        bdgs_sub_attr_path: Optional[Path],
    ) -> CityJSONFile:
        """
        Very big (too big) function that iterates over the given attributes and extract their associated geometries, formatting them into a CityJSONFile instance that can then be exported.

        Parameters
        ----------
        bdgs_attr_path : Optional[Path]
            Path to the CSV attributes of buildings.
        bdgs_sub_attr_path : Optional[Path]
            Path to the CSV attributes of buildings subdivisions.

        Returns
        -------
        CityJSONFile
            All the buildings with their attributes and units.

        Raises
        ------
        RuntimeError
            If the same CityJSON key is created twice for two different objects.
        """

        # Used to remember which 3DBAG buildings have already been processed
        unprocessed_bag_ids: set[str] = set(self.data["CityObjects"].keys())

        # Initialise CityJSON objects lists
        all_objects_cj: dict[str, CityJSONObjectSubclass] = {}

        def _process_bag_element(
            obj_key: str,
            bag_ids: list[str],
            unprocessed_bag_ids: set[str] | None = None,
            skip: bool = False,
        ) -> list[MultiSurface] | None:
            logging.log(logging.DEBUG, f"Processing {obj_key}")

            # Check if the key is already used
            if obj_key in all_objects_cj.keys():
                raise RuntimeError(
                    f"Object id {obj_key} already corresponds to another building."
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

        # Iterate over the buildings
        if bdgs_attr_path is not None:
            bdgs_attributes_all = BdgAttrReader(csv_path=bdgs_attr_path)
            bdgs_iterator = bdgs_attributes_all.iterator()
            for key, bdg_attributes in tqdm(
                bdgs_iterator,
                desc="Processing the buildings with attributes",
                total=len(bdgs_attributes_all),
            ):
                space_id = bdg_attributes.space_id
                obj_key = Building.key_to_cj_key(key=bdg_attributes.cj_key)
                print(f"{space_id = }")
                print(f"{bdg_attributes.bag_ids = }")

                geoms = _process_bag_element(
                    obj_key=obj_key,
                    bag_ids=bdg_attributes.bag_ids,
                    unprocessed_bag_ids=unprocessed_bag_ids,
                    skip=bdg_attributes.skip,
                )

                if geoms is not None:
                    building = Building(
                        cj_key=obj_key,
                        space_id=space_id,
                        geometries=geoms,
                        icon_position=bdg_attributes.icon_position,
                    )
                    building.add_attributes(bdg_attributes.attributes)
                    all_objects_cj[obj_key] = building

        # Iterate over the units
        if bdgs_sub_attr_path is not None:
            bdgs_sub_attributes_all = BdgSubAttrReader(csv_path=bdgs_sub_attr_path)
            bdgs_sub_iterator = bdgs_sub_attributes_all.iterator()
        for key, bdgs_sub_attributes in tqdm(
            bdgs_sub_iterator,
            desc="Processing the units",
            total=len(bdgs_sub_attributes_all),
        ):
            space_id = bdgs_sub_attributes.space_id
            parent_key = bdgs_sub_attributes.parent_cj_key
            prefix = CityJSONSpace.key_to_prefix(key=parent_key)

            # Add the missing hierarchy in the codes
            main_container_id = BuildingUnitContainer.unit_code_to_cj_key(
                code=BuildingUnitContainer.main_parent_code, prefix=prefix
            )
            if main_container_id not in all_objects_cj:
                main_container = BuildingUnitContainer(
                    cj_key=main_container_id,
                    unit_code=BuildingUnitContainer.main_parent_code,
                )
                bdg_obj_key = Building.key_to_cj_key(key=parent_key)
                bdg_obj = all_objects_cj[bdg_obj_key]
                all_objects_cj[main_container_id] = main_container
                CityJSONObject.add_parent_child(parent=bdg_obj, child=main_container)

            z_container_id = BuildingUnitContainer.unit_code_to_cj_key(
                code="BS", prefix=prefix
            )
            if z_container_id not in all_objects_cj:
                z_container = BuildingUnitContainer(
                    cj_key=z_container_id, unit_code="BS"
                )
                all_objects_cj[z_container_id] = z_container
                CityJSONObject.add_parent_child(
                    parent=main_container, child=z_container
                )
            z_container = all_objects_cj[z_container_id]
            assert isinstance(z_container, BuildingUnitContainer)

            # Find the number of units with the same code
            units_same_code = len(z_container.children_ids)

            obj_key = BuildingUnit.unit_code_to_cj_key(
                code="BS", prefix=prefix, index=units_same_code
            )

            unit = BuildingUnit(
                cj_key=obj_key,
                unit_code="BS",
                unit_storeys=[],
                icon_position=bdgs_sub_attributes.icon_position,
            )
            unit.add_attributes({"subdivision_number": space_id})
            unit.add_attributes(bdgs_sub_attributes.attributes)
            all_objects_cj[obj_key] = unit

            # Connect to the parent building
            CityJSONObject.add_parent_child(parent=z_container, child=unit)

        # Add the remaining buildings
        for bag_2d_id in tqdm(
            unprocessed_bag_ids, desc="Processing the remaining buildings"
        ):
            print(bag_2d_id)
            # Skip the children
            if bag_2d_id[-2] == "-":
                continue

            obj_key = Building.key_to_cj_key(key=bag_2d_id)

            geoms = _process_bag_element(
                obj_key=obj_key,
                bag_ids=[bag_2d_id],
            )

            if geoms is not None:

                building = Building(
                    cj_key=obj_key, space_id=bag_2d_id, geometries=geoms
                )
                all_objects_cj[obj_key] = building

        cj_file = CityJSONFile(
            scale=np.array([0.00001, 0.00001, 0.00001], dtype=np.float64),
            translate=np.array([0, 0, 0], dtype=np.float64),
        )
        cj_file.add_cityjson_objects(list(all_objects_cj.values()))

        return cj_file

    def export(self, output_cj_path: Path) -> None:
        """
        Export the result to the given path.

        Parameters
        ----------
        output_cj_path : Path
            The path to export to.
        """
        # Check the correctness of the hierarchy
        self.cj_file.check_objects_hierarchy()

        # Write to CityJSON
        output_cj_path.parent.mkdir(parents=True, exist_ok=True)
        file_json = self.cj_file.to_json()
        with open(output_cj_path, "w") as f:
            f.write(file_json)
