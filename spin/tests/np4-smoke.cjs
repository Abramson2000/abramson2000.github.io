'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const dir = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(dir, p), 'utf8');
const html = read('index.4.0.0.html');
const script = read('app.4.0.0.js');
const styles = read('design-4.0.css');
const sw = read('sw.4.0.0.js');
const manifest = JSON.parse(read('manifest.4.0.0.webmanifest'));
const tabs = ['program','theory','extras','practice','cheat','progress'];
const mainNav = html.match(/<nav class="nav-list">([\s\S]*?)<\/nav>/)?.[1];
const mobileNav = html.match(/<nav class="mobile-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
assert.ok(mainNav && mobileNav, 'Both navigation bars must exist');
for (const [name, nav] of [['desktop', mainNav], ['mobile', mobileNav]]) {
 const actual = [...nav.matchAll(/<button\b[^>]*data-tab="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(actual, tabs, 'Incorrect '+name+' navigation');
}
for(const id of tabs)assert.match(html,new RegExp('<section id="'+id+'" class="view'));
assert.match(script,/function renderExtras\(/);
assert.match(script,/function renderTheory\(/);
assert.match(script,/npCourseSelect/);
assert.ok(script.includes('data-ptab="selfcheck">Самопроверка</button>'), 'Self-check tab must be named Самопроверка');
assert.ok(!script.includes('Проверь себя'), 'Outdated user-facing text found');
assert.ok(styles.includes('#practice .cases-grid .case-card'), 'Case mobile cards lack compact layout');
assert.ok(styles.includes('#practice .cases-grid .case-card h2'), 'Case mobile headers not resized');

assert.ok(script.includes("const APP_VER = '4.0.0'"));
assert.match(script,/npRememberTheoryLocation/);
assert.match(script,/npRestoreTheoryLocation/);
assert.match(script,/function xToggleDone/);
assert.match(script,/cloudLoad\(/);
assert.match(html,/app\.4\.0\.0\.js/);
assert.match(html,/design-4\.0\.css/);
for(const tok of ['#FFF9EB','#F2C45A','#EADFCB'])assert.ok(styles.includes(tok),'missing palette '+tok);
assert.match(styles,/repeat\(6,minmax\(0,1fr\)\)/);
assert.equal(manifest.theme_color,'#FFF9EB');
assert.match(sw,/const VERSION = '4\.0\.0'/);
assert.ok(read('sw.js').includes("const VERSION = '4.0.0'"));
assert.ok(html.includes("navigator.serviceWorker.register('./sw.js'"));
const required = [
 ...['01_program_everest','02_theory_kailash','03_extras_yamdrok','04_practice_namtso','05_cheatsheets_shangrila','06_progress_drepung_stupa','07_login_pagoda'].flatMap(name=>['np40/'+name+'.webp','np40/mobile/'+name+'_960.webp']),
 ...['logo_horizontal_approved.png','logo_square_approved.png','logo_square_192.png','logo_square_512.png','logo_square_maskable_512.png','apple-touch-icon-180.png'].map(n=>'np40/'+n)
];
const missing=required.filter(p=>!fs.existsSync(path.join(dir,p)));
if (missing.length) {
 console.error('BLOCKING: approved image assets missing:\n'+missing.join('\n'));
 process.exitCode=1;
} else {
 console.log('OK: all 20 approved image assets present');
}
console.log('OK: 6 navigation tabs, JS structure, design tokens, PWA manifest checked');
