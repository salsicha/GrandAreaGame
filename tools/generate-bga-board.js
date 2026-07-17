// Generates bga/grandareagame_grandareagame.tpl by embedding frontend/map.svg
// into the BGA page template. The SVG's <style> block is stripped (its rules
// live in bga/grandareagame.css) because curly braces inside .tpl files can
// collide with the BGA template engine's {VARIABLE} syntax.
//
// Run: node tools/generate-bga-board.js
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const svgRaw = fs.readFileSync(path.join(repoRoot, 'frontend', 'map.svg'), 'utf8');

const svg = svgRaw
  .replace(/<\?xml[^>]*\?>\s*/, '')
  .replace(/\s*<style>[\s\S]*?<\/style>/, '')
  .trim();

if (svg.includes('{')) {
  throw new Error('Embedded SVG contains "{" which would break the BGA template engine');
}

const tpl = `{OVERALL_GAME_HEADER}

<div id="grandarea_table">
  <div id="grandarea_board">
    <div id="grandarea_map">
${svg.split('\n').map(line => (line.length ? '      ' + line : line)).join('\n')}
    </div>
  </div>
  <div id="grandarea_side_panel">
    <h3>{GRANDAREA_TITLE}</h3>
    <div id="grandarea_phase" class="grandarea-panel-row"></div>
    <div id="grandarea_round" class="grandarea-panel-row"></div>
    <div id="grandarea_crisis" class="grandarea-panel-row"></div>
    <div id="grandarea_selected" class="grandarea-panel-block"></div>
    <div id="grandarea_action_builder" class="grandarea-panel-block">
      <div class="grandarea-field">
        <label for="grandarea_action_select">{LABEL_ACTION}</label>
        <select id="grandarea_action_select"></select>
      </div>
      <div class="grandarea-field">
        <label for="grandarea_target_select">{LABEL_TARGET}</label>
        <select id="grandarea_target_select"></select>
      </div>
      <div class="grandarea-field">
        <label for="grandarea_framing">{LABEL_FRAMING}</label>
        <input id="grandarea_framing" type="number" min="0" max="50" step="1" value="0" />
      </div>
      <div id="grandarea_action_preview" class="grandarea-panel-row"></div>
      <a href="#" id="grandarea_commit" class="bgabutton bgabutton_blue">{LABEL_COMMIT}</a>
      <a href="#" id="grandarea_reveal" class="bgabutton bgabutton_blue">{LABEL_REVEAL}</a>
      <a href="#" id="grandarea_endturn" class="bgabutton bgabutton_gray">{LABEL_END_TURN}</a>
      <div id="grandarea_commit_status" class="grandarea-panel-row"></div>
    </div>
    <div id="grandarea_hand" class="grandarea-panel-block"></div>
    <div id="grandarea_log" class="grandarea-panel-block"></div>
  </div>
</div>

{OVERALL_GAME_FOOTER}
`;

fs.writeFileSync(path.join(repoRoot, 'bga', 'grandareagame_grandareagame.tpl'), tpl);
console.log('Wrote bga/grandareagame_grandareagame.tpl (' + tpl.length + ' bytes)');
