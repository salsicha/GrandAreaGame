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
- turn-manager actions such as Skim, Propaganda, Invade, Sanction, Protect, Coup, and False Flag

`map.svg` is a real world map generated from Natural Earth 110m data: each of the ten game regions is a merged group of countries, projected with the Natural Earth projection, with internal country borders drawn faintly inside each region. Regenerate it with `tools/generate-world-map.mjs` (see the header comment for the ad-hoc dependencies) after changing region assignments or styling.
You can now either edit `map.svg` so each territory element contains a `data-country` attribute matching a key in `data/territories.json`, or provide a `data/mapping.json` file that maps SVG element IDs to territory keys. An example mapping file is provided as `data/mapping-example.json`.

Recommended workflow to import a high-fidelity SVG:

1. Obtain/export an SVG map (e.g., via QGIS export, Inkscape, or a world SVG resource).
2. Ensure each territory path/group has either a `data-country` attribute equal to your territory key, or a unique `id` you can reference in `data/mapping.json`.
3. Optionally create `data/mapping.json` with entries like `{ "svgElementId": "TerritoryKey" }`.
4. Start the prototype server and open the UI. Use the "Upload SVG map" control to load your new SVG, or drop `map.svg` into the `frontend` folder and press "Load default map".

Next steps: wire to a rules engine and implement secret action handling.
