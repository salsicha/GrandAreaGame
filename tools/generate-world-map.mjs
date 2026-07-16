// Generates frontend/map.svg for Grand Area from Natural Earth 110m data.
// The ten game regions are merged country geometries, projected with the
// Natural Earth projection, and emitted with the ids, classes, and
// data-country attributes the frontend and tests expect.
//
// Deps (not repo dependencies; install ad hoc):
//   npm install --no-save world-atlas@2 topojson-client@3 d3-geo@3
// Run:
//   node tools/generate-world-map.mjs > frontend/map.svg
import { createRequire } from 'node:module';
import { feature, merge, mesh } from 'topojson-client';
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo';

const require = createRequire(import.meta.url);
const topology = require('world-atlas/countries-110m.json');

const REGIONS = {
  NorthAmerica: ['United States of America', 'Canada', 'Greenland'],
  LatinAmerica: [
    'Mexico', 'Guatemala', 'Belize', 'El Salvador', 'Honduras', 'Nicaragua', 'Costa Rica', 'Panama',
    'Cuba', 'Haiti', 'Dominican Rep.', 'Jamaica', 'Bahamas', 'Puerto Rico', 'Trinidad and Tobago',
    'Colombia', 'Venezuela', 'Guyana', 'Suriname', 'Ecuador', 'Peru', 'Brazil', 'Bolivia',
    'Paraguay', 'Chile', 'Argentina', 'Uruguay', 'Falkland Is.'
  ],
  WesternEurope: [
    'Iceland', 'Ireland', 'United Kingdom', 'Portugal', 'Spain', 'France', 'Belgium', 'Netherlands',
    'Luxembourg', 'Germany', 'Switzerland', 'Austria', 'Italy', 'Denmark', 'Norway', 'Sweden',
    'Finland', 'Greece'
  ],
  EasternEurope: [
    'Estonia', 'Latvia', 'Lithuania', 'Poland', 'Czechia', 'Slovakia', 'Hungary', 'Slovenia',
    'Croatia', 'Bosnia and Herz.', 'Serbia', 'Montenegro', 'Kosovo', 'Macedonia', 'Albania',
    'Romania', 'Bulgaria', 'Moldova', 'Ukraine', 'Belarus', 'Russia', 'Georgia', 'Armenia',
    'Azerbaijan', 'Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan'
  ],
  NorthAfrica: ['Morocco', 'W. Sahara', 'Algeria', 'Tunisia', 'Libya', 'Egypt', 'Mauritania', 'Sudan'],
  SubSaharanAfrica: [
    'Mali', 'Niger', 'Chad', 'Senegal', 'Gambia', 'Guinea-Bissau', 'Guinea', 'Sierra Leone',
    'Liberia', "Côte d'Ivoire", 'Burkina Faso', 'Ghana', 'Togo', 'Benin', 'Nigeria', 'Cameroon',
    'Central African Rep.', 'S. Sudan', 'Ethiopia', 'Eritrea', 'Djibouti', 'Somalia', 'Somaliland',
    'Kenya', 'Uganda', 'Rwanda', 'Burundi', 'Tanzania', 'Dem. Rep. Congo', 'Congo', 'Gabon',
    'Eq. Guinea', 'Angola', 'Zambia', 'Malawi', 'Mozambique', 'Zimbabwe', 'Botswana', 'Namibia',
    'South Africa', 'Lesotho', 'eSwatini', 'Madagascar'
  ],
  MiddleEast: [
    'Turkey', 'Cyprus', 'N. Cyprus', 'Syria', 'Lebanon', 'Israel', 'Palestine', 'Jordan', 'Iraq',
    'Iran', 'Kuwait', 'Saudi Arabia', 'Qatar', 'United Arab Emirates', 'Oman', 'Yemen'
  ],
  SouthAsia: ['Afghanistan', 'Pakistan', 'India', 'Nepal', 'Bhutan', 'Bangladesh', 'Sri Lanka'],
  EastAsia: [
    'China', 'Mongolia', 'North Korea', 'South Korea', 'Japan', 'Taiwan', 'Myanmar', 'Thailand',
    'Laos', 'Cambodia', 'Vietnam', 'Malaysia', 'Brunei', 'Philippines', 'Indonesia', 'Timor-Leste'
  ],
  Oceania: ['Australia', 'New Zealand', 'Papua New Guinea', 'Fiji', 'Solomon Is.', 'Vanuatu', 'New Caledonia']
};
const EXCLUDED = new Set(['Antarctica', 'Fr. S. Antarctic Lands']);

const SVG_IDS = {
  NorthAmerica: 't_north_america',
  LatinAmerica: 't_latin_america',
  WesternEurope: 't_western_europe',
  EasternEurope: 't_eastern_europe',
  NorthAfrica: 't_north_africa',
  SubSaharanAfrica: 't_sub_saharan_africa',
  MiddleEast: 't_middle_east',
  SouthAsia: 't_south_asia',
  EastAsia: 't_east_asia',
  Oceania: 't_oceania'
};

const BASE_FILLS = {
  NorthAmerica: '#dfe6e9',
  LatinAmerica: '#fbe7c6',
  WesternEurope: '#e8f5e9',
  EasternEurope: '#e1f5fe',
  NorthAfrica: '#fff3e0',
  SubSaharanAfrica: '#f6e4d9',
  MiddleEast: '#fef9c3',
  SouthAsia: '#dcfce7',
  EastAsia: '#e6f7ff',
  Oceania: '#f3e5f5'
};

// [display label, anchor lon, anchor lat, optional font size]
const LABELS = {
  NorthAmerica: ['North America', -98, 44],
  LatinAmerica: ['Latin America', -60, -12],
  WesternEurope: ['Western Europe', -1, 46, 12],
  EasternEurope: ['Eastern Europe', 44, 56],
  NorthAfrica: ['North Africa', 10, 26],
  SubSaharanAfrica: ['Sub-Saharan Africa', 21, -4, 13],
  MiddleEast: ['Middle East', 45, 23, 12],
  SouthAsia: ['South Asia', 77, 20, 12],
  EastAsia: ['East Asia', 103, 34],
  Oceania: ['Oceania', 134, -25]
};

const regionByName = new Map();
for (const [region, names] of Object.entries(REGIONS)) {
  for (const name of names) {
    if (regionByName.has(name)) throw new Error(`duplicate assignment: ${name}`);
    regionByName.set(name, region);
  }
}

const countries = topology.objects.countries;
const unassigned = countries.geometries
  .map(g => g.properties.name)
  .filter(name => !regionByName.has(name) && !EXCLUDED.has(name));
if (unassigned.length) throw new Error(`unassigned countries: ${unassigned.join(', ')}`);

const regionOf = geometry => regionByName.get(geometry.properties.name) || null;

const projection = geoNaturalEarth1().fitExtent([[10, 12], [1190, 588]], { type: 'Sphere' });
const path = geoPath(projection);
const round = d => d && d.replace(/-?\d+(?:\.\d+)?/g, n => {
  const value = Math.round(Number(n) * 10) / 10;
  return Object.is(value, -0) ? '0' : String(value);
});

const lines = [];
lines.push('<?xml version="1.0" encoding="UTF-8"?>');
lines.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 600" role="img" aria-label="World map of Grand Area regions">');
lines.push('  <style>');
lines.push('    .label{font-family:Inter,Arial,sans-serif;fill:#22303a;font-size:15px;font-weight:600;letter-spacing:.02em;pointer-events:none;paint-order:stroke;stroke:#f6fbff;stroke-width:3px;stroke-linejoin:round}');
lines.push('    .territory{stroke:#54707e;stroke-width:.8;stroke-linejoin:round}');
lines.push('    .map-underlay,.map-borders{pointer-events:none}');
lines.push('  </style>');
lines.push(`  <path class="map-underlay" d="${round(path({ type: 'Sphere' }))}" fill="#c8dfee"/>`);
lines.push(`  <path class="map-underlay" d="${round(path(geoGraticule10()))}" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="0.6"/>`);
lines.push('  <g id="territories">');
for (const region of Object.keys(REGIONS)) {
  const parts = countries.geometries.filter(g => regionOf(g) === region);
  const merged = merge(topology, parts);
  const d = round(path(merged));
  lines.push(`    <path id="${SVG_IDS[region]}" class="territory" d="${d}" fill="${BASE_FILLS[region]}" data-country="${region}"/>`);
}
lines.push('  </g>');
const innerBorders = mesh(topology, countries, (a, b) => a !== b && regionOf(a) != null && regionOf(a) === regionOf(b));
lines.push(`  <path class="map-borders" d="${round(path(innerBorders))}" fill="none" stroke="#54707e" stroke-opacity="0.28" stroke-width="0.5"/>`);
lines.push('  <g id="labels">');
for (const region of Object.keys(REGIONS)) {
  const [text, lon, lat, size] = LABELS[region];
  const [x, y] = projection([lon, lat]).map(v => Math.round(v * 10) / 10);
  const fontAttr = size ? ` font-size="${size}"` : '';
  lines.push(`    <text x="${x}" y="${y}" text-anchor="middle" class="label"${fontAttr}>${text}</text>`);
}
lines.push('  </g>');
lines.push('</svg>');

process.stdout.write(lines.join('\n') + '\n');
