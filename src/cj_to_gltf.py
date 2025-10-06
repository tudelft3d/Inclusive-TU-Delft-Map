import json
from copy import deepcopy
from pathlib import Path
from typing import Any

import numpy as np
import trimesh
from tqdm import tqdm

from cj_loader import CityjsonLoader, cj_object_to_mesh


class Cityjson2Gltf(CityjsonLoader):

    def __init__(self, cj_path: Path) -> None:
        super().__init__(cj_path)

    def make_gltf_scene(self):

        objects: dict[str, dict] = self.data["CityObjects"]
        scene = trimesh.Scene()

        # First insert all the objects without hierarchy
        for obj_id, obj in tqdm(objects.items(), desc="Inserting the objects"):
            meshes_lods = cj_object_to_mesh(
                obj_dict=obj,
                vertices=self.vertices,
            )
            # Insert an empty node so children can still to it
            scene.graph.update(frame_to=obj_id, frame_from=None, matrix=np.eye(4))
            if meshes_lods is not None:
                for lod, mesh in meshes_lods.items():
                    scene.add_geometry(
                        mesh,
                        node_name=obj_id + "-lod_" + lod,
                        parent_node_name=obj_id,
                    )

        # Then set up the structure
        for obj_id, obj in tqdm(objects.items(), desc="Setting up the structure"):
            parent = obj.get("parent", None)
            if parent is not None:
                # Attach child node to its parent in the scene graph
                scene.graph.update(
                    frame_to=obj_id,
                    frame_from=parent,
                    matrix=np.eye(4),
                )
            # If the object defines explicit "children", ensure they are linked too
            for child_id in obj.get("children", []):
                scene.graph.update(
                    frame_to=child_id,
                    frame_from=obj_id,
                    matrix=np.eye(4),
                )

        self.scene = scene

    def export(self, output_folder: Path, overwrite: bool = False) -> None:
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
