# Frontend prototype

To run the prototype, open `frontend/index.html` in a web browser, or serve the folder with a static server:

```bash
cd frontend
python3 -m http.server 8000
# then open http://localhost:8000
```

This is a minimal static prototype demonstrating:
- clickable territories (SVG)
- simple per-country state (wealth, happiness, stash)
- three actions: Skim, Propaganda, Invade

This update replaces the earlier mock map with a larger regional SVG (`map.svg`) and expands the territory metadata in `data/territories.json` to continent-level entries. Replace `map.svg` with a more detailed world SVG (for example a GeoJSON -> SVG export) and map `data/territories.json` keys to the appropriate `data-country` values inside the SVG to scale up fidelity.
You can now either edit `map.svg` so each territory element contains a `data-country` attribute matching a key in `data/territories.json`, or provide a `data/mapping.json` file that maps SVG element IDs to territory keys. An example mapping file is provided as `data/mapping-example.json`.

Recommended workflow to import a high-fidelity SVG:

1. Obtain/export an SVG map (e.g., via QGIS export, Inkscape, or a world SVG resource).
2. Ensure each territory path/group has either a `data-country` attribute equal to your territory key, or a unique `id` you can reference in `data/mapping.json`.
3. Optionally create `data/mapping.json` with entries like `{ "svgElementId": "TerritoryKey" }`.
4. Start the prototype server and open the UI. Use the "Upload SVG map" control to load your new SVG, or drop `map.svg` into the `frontend` folder and press "Load default map".

Next steps: wire to a rules engine and implement secret action handling.
