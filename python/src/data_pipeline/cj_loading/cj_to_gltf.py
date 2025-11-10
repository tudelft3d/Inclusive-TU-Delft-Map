"""
Scripts to load CityJSON files exported by the other scripts and export to a dual CityJSON/glTF format by transferring all the geometry to glTF.
"""

import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from data_pipeline.cj_loading.cj_loader import CityjsonLoader, cj_object_to_mesh
from tqdm import tqdm


class Cityjson2Gltf(CityjsonLoader):
    """
    Load a CityJSON file and transforms it into a pair formed by a glTF file storing the geometry and a CityJSON file storing the attributes.
    The hierarchy of the CityJSON file is fully preserved, only the geometry is removed and stored in glTF, with identifiers of the form `<cityjson_key>-lod_<lod>`.
    The hierarchy of the CityJSON file is also reproduced in glTF, with all LoDs stored as children of their main object, which has no geometry.
    """

    def __init__(self, cj_path: Path) -> None:
        super().__init__(cj_path)

    def make_gltf_scene(self):
        """
        Create the scene for glTF, preserving the structure from the CityJSON input.
        """
        objects: dict[str, dict] = self.data["CityObjects"]
        scene = trimesh.Scene()

        # First insert all the objects without hierarchy
        for obj_key, obj in tqdm(objects.items(), desc="Inserting the objects"):
            meshes_lods = cj_object_to_mesh(
                obj_dict=obj,
                vertices=self.vertices,
            )
            # Insert an empty node so children can still to it
            scene.graph.update(frame_to=obj_key, frame_from=None, matrix=np.eye(4))
            if meshes_lods is not None:
                for lod, mesh in meshes_lods.items():
                    scene.add_geometry(
                        mesh,
                        node_name=obj_key + "-lod_" + lod,
                        parent_node_name=obj_key,
                    )

        # Then set up the structure
        for obj_key, obj in tqdm(objects.items(), desc="Setting up the structure"):
            parent = obj.get("parent", None)
            if parent is not None:
                # Attach child node to its parent in the scene graph
                scene.graph.update(
                    frame_to=obj_key,
                    frame_from=parent,
                    matrix=np.eye(4),
                )
            # If the object defines explicit "children", ensure they are linked too
            for child_id in obj.get("children", []):
                scene.graph.update(
                    frame_to=child_id,
                    frame_from=obj_key,
                    matrix=np.eye(4),
                )

        self.scene = scene

    def export(self, output_folder: Path, overwrite: bool = False) -> None:
        """
        Export the dual representation into the given folder.

        Parameters
        ----------
        output_folder : Path
            The path to the folder where the files should be written.
        overwrite : bool, optional
            Whether to overwrite the files if they exist.
            By default False.

        Raises
        ------
        RuntimeError
            If the path of any of the two outputs already exists and `overwrite` was not set to True.
        """
        output_folder.mkdir(parents=True, exist_ok=overwrite)
        glb_path = output_folder / "geometry.glb"
        cj_path = output_folder / "attributes.city.json"
        if not overwrite:
            if glb_path.exists():
                raise RuntimeError(
                    f"File {glb_path} already exists. Set `overwrite` to True to overwrite."
                )
            if cj_path.exists():
                raise RuntimeError(
                    f"File {cj_path} already exists. Set `overwrite` to True to overwrite."
                )

        # Write the glb file with geometry
        self.scene.export(glb_path)

        # Write the CityJSON file with structure and attributes
        cj_data_copy = deepcopy(self.data)
        objects: dict[str, dict[str, Any]] = cj_data_copy["CityObjects"]
        # Remove the geometry
        for obj in objects.values():
            if "geometry" in obj:
                obj.pop("geometry")
        cj_data_copy["vertices"] = []
        with open(cj_path, "w") as cj_file:
            json.dump(cj_data_copy, cj_file)
