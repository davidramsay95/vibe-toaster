// Offline still renderer: drives the same Stage as the site, frozen on a configured pose.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import { Stage } from './stage.js';

await Promise.all([document.fonts.load('300 40px "Geist Variable"'), document.fonts.load('500 20px "Geist Mono Variable"'), document.fonts.load('600 40px "Geist Variable"')]);
const cfg = JSON.parse(new URLSearchParams(location.search).get('p') || '{}');
const stage = new Stage(document.getElementById('stage'));
stage.quality = 1;
const { color = 'titanium', display = { mode: 'ready', title: 'Golden.', sub: 'Exactly how you like it. Probably.', level: 3.7 }, ...pose } = cfg;
stage.setColorway(color);
Object.assign(stage.target, { explode: 0, pop: 1, heat: 0.2, level: 0.5, halo: 1, shift: 0, shiftY: 0, tx: 0, ty: 0.9, el: 0.2, dist: 8.6, spin: -0.55 }, pose);
stage.display = display;
stage.snap();
let n = 0;
function loop() {
  stage.update(0.03);
  stage.mood.copy(stage.moodTarget);
  stage.render();
  if (++n === 8) window.__ready = true;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
