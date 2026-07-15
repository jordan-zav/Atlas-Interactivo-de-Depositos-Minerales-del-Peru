# Copyright (c) 2026 Jordan Zavaleta
# This file is part of Atlas-Interactivo-de-Depositos-Minerales-del-Peru.
# Atlas-Interactivo-de-Depositos-Minerales-del-Peru is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

from __future__ import annotations

import json
import os
import re
import sys
import warnings
import xml.etree.ElementTree as ET
from pathlib import Path

import geopandas as gpd


ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
BUILD_DIR = ROOT / "build"

DEPOSITS_GPKG = DATA_DIR / "yacimientos_mineros.gpkg"
DEPOSITS_QML = DATA_DIR / "yacimientos_mineros.qml"
BELTS_GPKG = DATA_DIR / "franja_metalogentica.gpkg"
BELTS_QML = DATA_DIR / "franja_metalogentica.qml"

DEPOSITS_GEOJSON = BUILD_DIR / "yacimientos_mineros.geojson"
BELTS_GEOJSON = BUILD_DIR / "franja_metalogentica.geojson"
STYLES_JSON = BUILD_DIR / "styles.json"
METADATA_JSON = BUILD_DIR / "metadata.json"


def fix_text(value):
    if not isinstance(value, str):
        return value
    value = value.strip()
    if not value:
        return value
    if "Ã" in value or "Â" in value:
        try:
            return value.encode("latin-1").decode("utf-8")
        except UnicodeError:
            return value
    return value


def sanitize_records(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    copy = gdf.copy()
    for column in copy.columns:
        if column == copy.geometry.name:
            continue
        copy[column] = copy[column].map(fix_text)
    return copy


def extract_option_map(layer_node: ET.Element | None) -> dict[str, str]:
    if layer_node is None:
        return {}
    option_map = layer_node.find("Option[@type='Map']")
    if option_map is None:
        return {}
    values: dict[str, str] = {}
    for child in option_map.findall("Option"):
        name = child.attrib.get("name")
        if name:
            values[name] = child.attrib.get("value", "")
    return values


def qgis_rgba_to_css(raw: str, alpha_override: str | None = None) -> str:
    parts = raw.split(",")
    rgba = []
    for item in parts[:4]:
        try:
            rgba.append(int(float(item)))
        except ValueError:
            rgba.append(0)
    while len(rgba) < 4:
        rgba.append(255)
    if alpha_override is not None:
        try:
            rgba[3] = round(float(alpha_override) * 255)
        except ValueError:
            pass
    return f"rgba({rgba[0]}, {rgba[1]}, {rgba[2]}, {rgba[3] / 255:.3f})"


def parse_category_styles(qml_path: Path, geometry_kind: str) -> dict:
    tree = ET.parse(qml_path)
    root = tree.getroot()
    renderer = root.find("renderer-v2")
    if renderer is None:
        raise RuntimeError(f"No se encontró renderer-v2 en {qml_path.name}")

    attr = renderer.attrib.get("attr", "")
    categories = renderer.find("categories")
    symbols = renderer.find("symbols")
    if categories is None or symbols is None:
        raise RuntimeError(f"No se encontraron categorías o símbolos en {qml_path.name}")

    symbol_map = {
        symbol.attrib.get("name", ""): symbol for symbol in symbols.findall("symbol")
    }

    category_styles: dict[str, dict] = {}
    category_labels: dict[str, str] = {}

    for category in categories.findall("category"):
        value = fix_text(category.attrib.get("value", ""))
        label = fix_text(category.attrib.get("label", value))
        symbol_name = category.attrib.get("symbol", "")
        symbol = symbol_map.get(symbol_name)
        if symbol is None:
            continue

        if geometry_kind == "point":
            layer = symbol.find("layer")
            opts = extract_option_map(layer)
            image_b64 = opts.get("imageFile", "")
            if image_b64.startswith("base64:"):
                image_b64 = image_b64.split(":", 1)[1]
            category_styles[value] = {
                "type": "icon",
                "iconUrl": f"data:image/png;base64,{image_b64}",
                "iconSize": float(opts.get("size", "9") or 9),
                "alpha": float(opts.get("alpha", "1") or 1),
            }
        else:
            layer = symbol.find("layer")
            opts = extract_option_map(layer)
            category_styles[value] = {
                "type": "fill",
                "fillColor": qgis_rgba_to_css(opts.get("color", "200,200,200,255")),
                "strokeColor": qgis_rgba_to_css(opts.get("outline_color", "120,120,120,255")),
                "strokeWidth": float(opts.get("outline_width", "1") or 1),
            }

        category_labels[value] = label

    return {
        "field": attr,
        "styles": category_styles,
        "labels": category_labels,
    }


def needs_rebuild() -> bool:
    outputs = [DEPOSITS_GEOJSON, BELTS_GEOJSON, STYLES_JSON, METADATA_JSON]
    if any(not output.exists() for output in outputs):
        return True

    newest_source = max(
        path.stat().st_mtime
        for path in [DEPOSITS_GPKG, DEPOSITS_QML, BELTS_GPKG, BELTS_QML]
    )
    oldest_output = min(path.stat().st_mtime for path in outputs)
    return newest_source > oldest_output


def export_geojson(source: Path, destination: Path) -> dict:
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="Error parsing datetimes, original strings are returned:*",
        )
        gdf = gpd.read_file(source)
    gdf = sanitize_records(gdf)
    gdf = gdf.to_crs(epsg=4326)
    gdf.to_file(destination, driver="GeoJSON", encoding="utf-8")
    bounds = [float(value) for value in gdf.total_bounds]
    return {
        "count": int(len(gdf)),
        "bounds": bounds,
        "columns": [column for column in gdf.columns if column != gdf.geometry.name],
    }


def build() -> None:
    BUILD_DIR.mkdir(parents=True, exist_ok=True)

    deposits_meta = export_geojson(DEPOSITS_GPKG, DEPOSITS_GEOJSON)
    belts_meta = export_geojson(BELTS_GPKG, BELTS_GEOJSON)

    styles = {
        "yacimientos": parse_category_styles(DEPOSITS_QML, "point"),
        "franjas": parse_category_styles(BELTS_QML, "polygon"),
    }
    STYLES_JSON.write_text(
        json.dumps(styles, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    metadata = {
        "projectName": "Atlas Interactivo de Depósitos Minerales",
        "layers": {
            "yacimientos": deposits_meta,
            "franjas": belts_meta,
        },
    }
    METADATA_JSON.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def main() -> int:
    force = "--force" in sys.argv
    if force or needs_rebuild():
        build()
        print("Datos preparados en build/.")
    else:
        print("Los datos ya están actualizados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
