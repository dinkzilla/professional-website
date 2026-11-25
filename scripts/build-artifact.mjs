// Packs the production build into one self-contained page for claude.ai:
// artifact/holiday-romance.html (styles and script inlined, no <html>/<head> wrapper).
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = 'dist/holiday-romance/browser';
const files = readdirSync(dist);
const read = (ext) =>
  files
    .filter((f) => f.endsWith(ext))
    .map((f) => readFileSync(join(dist, f), 'utf8'))
    .join('\n');

const js = read('.js').replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
const css = read('.css');
if (files.filter((f) => f.endsWith('.js')).length !== 1) {
  throw new Error('Expected a single script bundle; lazy chunks cannot be inlined.');
}

const page = `<title>Yule Swoon</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=Caveat:wght@500&family=Figtree:wght@400..700&display=swap">
<style>${css}</style>
<app-root></app-root>
<script type="module">${js}</script>
`;

mkdirSync('artifact', { recursive: true });
writeFileSync('artifact/holiday-romance.html', page);
console.log(`artifact/holiday-romance.html  ${(page.length / 1024).toFixed(0)} kB`);
