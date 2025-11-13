# Blender

This document explains how and where Blender was used throughout the completion of this project.

## Introduction to Blender

Blender is a free and open-source program for the creation, manipulation and rendering of 3D data formats. Being free makes it an excellent choice for projects such as this one, as it ensures the software will be able for future groups. All of the operations performed using Blender are of a beginner level and only pertain to mesh creation and manipulation. This should allow somebody with no experience in Blender to perform these tasks with only a minimal amount of practice. The web is full of tutorials that should expedite this learning process.

## 3DBAG Mesh Reconstruction

One of the primary tasks that Blender was used for was the reconstruction of 3DBAG building meshes. Reconstructing these meshes ensures that they are geometrically valid and aesthetically pleasing. Additionally reconstructing the meshes allows for the inclusion of overhang elements, which are not present in 3DBAG meshes.

This reconstruction process begins with importing the 3DBAG mesh of the relevant building, as it will act as a guide. For simple building it can be enough to trace the outline and then extrude to the appropriate height. For more complex shapes we recommend first blocking out the general structure, and then adding all necessary detail. It is important to strike a balance between accuracy and simplicity. Over-complicating the building meshes will increase visual clutter and make them harder to texture.

## IFC / PDF Interior Export

Interior data was extracted from IFC files of the interiors, which are maintained by the CREFM. These files can be opened in Blender using the free addon: Bonsai. Once these files were imported, they were flattened into their 2D footprints, and sorted into the building, building-part, building-storey hierachy. The room geometry encoded in the IFC files were correctly labled with their space-ids, making it easy to link them to their respective cityjson objects when the GLTF file was loaded.

In the event that IFC files are not available we also tested extracting geometry from floor plan PDF files. Opening these files into a program such as Adobe Illustrator can allow for the extraction of the room geometries as SVG elements. These can then be opened in Blender and exported as geometry. The downside of the method is that room labels are not present, meaning that every map element would need to be labled by hand. Furthermore this method was only tested for Adobe Illustrator which is not a free program.

## Additional Geometry

Geometry for ramps, entrances / exits, mini-stairs and other features was modeled in Blender, using the building shells and floor plan PDFs to ensure that their size and locations were correct.

## Positioning The Geometry

Geometry that we exported from Blender was correctly positioned in regards to CRS 28992 (the standard Dutch one). This can be achieved in Blender by moving the geometry to the correct position before exporting. Using 3DBAG geometry as a guide during the modelling process will ensure that this happens smoothly, as these geometries are correctly placed with regards to the used CRS.

It may be desirable to work on the geometry around the file origin, and only move it into the correct position when ready to export. Blender becomes unstable when working in positions that are extremely far removed from the origin.

## Future Work

Accurate texturing of the campus buildings was one of the features requested during the interviews. This can be done in Blender, as any textures and materials will be exported along with geometry when creating a GLTF file.