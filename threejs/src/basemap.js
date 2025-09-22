import 'ol/ol.css';
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import WMTS from 'ol/source/WMTS.js';
import WMTSTileGrid from 'ol/tilegrid/WMTS.js';
import {getTopLeft} from 'ol/extent.js';
import {register} from 'ol/proj/proj4.js';
import {get as getProjection} from 'ol/proj.js';
import proj4 from 'proj4';

export function createBasemap(targetID) {
  // Define EPSG:28992 projection (Amersfoort / RD New)
  proj4.defs(
    "EPSG:28992",
    "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 " +
    "+k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel " +
    "+towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 " +
    "+units=m +no_defs"
  );
  register(proj4);

  const projection = getProjection("EPSG:28992");
  const extent = [84000, 443500, 87000, 448000]; 
  projection.setExtent(extent);

  const tileGrid = new WMTSTileGrid({
    origin: getTopLeft(projection.getExtent()),
    resolutions: [
      3440.64, 1720.32, 860.16, 430.08, 215.04,
      107.52, 53.76, 26.88, 13.44, 6.72,
      3.36, 1.68, 0.84, 0.42, 0.21
    ],
    matrixIds: Array.from({length: 15}, (_, i) => i.toString())
  });

  const wmtsLayer = new TileLayer({
    source: new WMTS({
      url: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/',
      layer: 'Actueel_ortho25',
      matrixSet: 'EPSG:28992',
      format: 'image/png',
      projection: projection,
      tileGrid: tileGrid,
      style: 'default',
      crossOrigin: 'anonymous',
    })
  });

  const basemap = new Map({
    target: targetID,
    layers: [wmtsLayer],
    view: new View({
      projection: projection,
      center: [85500, 445750],
      extent: extent,
      zoom: 16
    })
  });

  return basemap;
}
