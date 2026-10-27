<p align="center"><strong>English</strong> · <a href="README.es.md">Español</a></p>

# Interactive Atlas of Mineral Deposits in Peru

**Explore mineral deposits and metallogenic belts in a portable local web viewer.**

Open the atlas, search deposits or belts, draw a polygon or rectangle to query
an area and export results to CSV. The viewer runs on your own computer.

## Quick start

1. On Windows, run [iniciar_atlas.bat](iniciar_atlas.bat).
2. The launcher opens the local viewer in your browser.
3. Search a deposit or belt, toggle the belt layer, or draw a query area.
4. Export the results when needed.
5. Close the console window to stop the local server.

## Requirements and portability

Windows with PowerShell is sufficient when the prepared build directory is
already present. Python 3 is needed to regenerate viewer data from the source
GeoPackage and QML files. The project uses relative paths so its folder can be
moved without rewriting absolute paths.

## Included features

- Mineral-deposit display and search.
- Metallogenic-belt visibility controls and search.
- Spatial queries using drawn polygons or rectangles.
- CSV export and local execution.

Inspect source attribution, coordinate reference information and data coverage
before using the displayed records for interpretation. This viewer does not
turn its inventory into a mineral-resource estimate.

## Repository layout

| Path | Contents |
| --- | --- |
| data | Original GeoPackage data and QML styles |
| build | Prepared data used by the web viewer |
| web | Atlas interface |
| scripts/build_data.py | GeoPackage conversion and QML symbology extraction |
| scripts/start_server.ps1 | Portable local server |

The [Spanish quick-start note](LEEME.md) is retained for existing users.

## Licensing

The repository describes a dual-licensing model: open-source distribution under
GNU GPL v3, with separate commercial licensing for proprietary integration.
The governing open-source terms are in [LICENSE](LICENSE). Contact the author
to discuss a separate commercial agreement; third-party data retain their own terms.

## Contact

Jordan Zavaleta — [GisGeo Dev](https://gisgeo.dev) ·
[jordanzav@gisgeo.dev](mailto:jordanzav@gisgeo.dev).
