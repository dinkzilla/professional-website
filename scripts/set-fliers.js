// Puts fliers on the board in the personal side's room, and arranges them. Run with seven
// pictures:
//
//   npm run fliers -- 1.jpg 2.png 3.webp 4.jpg 5.jpg 6.jpg 7.png
//
// The board shows whatever pictures are in src/lib/assets/fliers, in the order of their names
// (see flierArt in src/lib/shelf/objects/fliers.ts). This replaces all of them: each picture given is
// made no larger than a flier needs, saved there as 1.webp to 7.webp, and what was there before
// is removed. Nothing is changed unless every picture can be read.
//
// Then it works out where each is pinned, and writes that beside them as layout.json. Seven do
// not fit on the board side by side, so they overlap, and are to look thrown up anyhow while
// hiding as little of each other as can be: no two arrangements are the same. To have the
// pictures that are there arranged again, another way:
//
//   npm run fliers -- --arrange
//
// Either way `--seed 123` gives the arrangement that seed gave before, and a picture of the board
// as arranged is left in flier-candidates/board-preview.png, to be looked at.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const COUNT = 7;
// The longest side of a saved picture: a flier taken down fills the window, and is to be read,
// so this is as much as a large window shows of it.
const LONGEST = 1600;
// A picture smaller than this on its longer side is too small to read once it fills a window.
const SMALLEST = 900;

// The board, in the room's units (see PINBOARD in rack.ts), and what a flier is kept inside.
const BOARD = { left: -1.7, right: 0, bottom: 1.21, top: 2.4 };
// The board's frame comes this far in over the cork and stands further off the wall than a
// flier does, so a flier that reached it would go into it; and a little more than that is kept.
const FRAME = 0.025;
const EDGE = FRAME + 0.02;
// A flier turns this far on its pin under the pointer, at most (see `swing` in types.ts), which
// swings its foot out to the side: room is kept for that too.
const SWING = 0.1;
// The rack and the tv on it stand in front of the board's right end: nothing is pinned behind
// the tv, and what is low down behind the rack's side is as good as hidden.
const BEHIND_TV = -0.2;
const BEHIND_RACK = { left: -0.52, top: 1.78 };
// How much paper a flier is, whatever its shape, and the widest and tallest one is hung.
const PAPER = 0.18;
const WIDEST = 0.5;
const TALLEST = 0.6;
// How much further off the wall each flier is than the one it is pinned over.
const OVER = 0.008;
// How many of them have the one pin, at the top, and wave in the air from the door. These are
// over all the others and clear of one another, so that nothing is ever in their way. The rest
// are pinned top and foot and stay still: sheets moving against each other went through each
// other, or looked wrong kept from it (2026-11-19).
const WAVING = 3;
// A pin is this far in from the edge of its sheet (as in objects/fliers.ts), and wants this much clear.
const PIN_DOWN = 0.022;
const PIN_CLEAR = 0.03;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fliersDir = path.join(root, 'src/lib/assets/fliers');
const previewDir = path.join(root, 'flier-candidates');

const args = process.argv.slice(2);
const flag = (name) => {
	const at = args.indexOf(name);
	if (at < 0) return undefined;
	return args.splice(at, 2)[1];
};
const seedGiven = flag('--seed');
const arrangeOnly = args.includes('--arrange');
if (arrangeOnly) args.splice(args.indexOf('--arrange'), 1);

// --- The pictures ----------------------------------------------------------------------------

if (!arrangeOnly) {
	if (args.length !== COUNT) {
		console.error(`The board takes ${COUNT} fliers, and ${args.length} were given.`);
		process.exit(1);
	}
	const made = [];
	for (const file of args) {
		try {
			const { data, info } = await sharp(file)
				.rotate() // as the camera that took it says it was held
				.resize(LONGEST, LONGEST, { fit: 'inside', withoutEnlargement: true })
				.flatten({ background: '#ffffff' })
				.webp({ quality: 86 })
				.toBuffer({ resolveWithObject: true });
			if (Math.max(info.width, info.height) < SMALLEST) {
				console.error(`${file} is only ${info.width}x${info.height}: too small to be read. A larger copy is needed.`);
				process.exit(1);
			}
			made.push({ file, data, info });
		} catch (error) {
			console.error(`${file} could not be read as a picture: ${error.message}`);
			process.exit(1);
		}
	}
	await mkdir(fliersDir, { recursive: true });
	for (const old of await readdir(fliersDir)) await rm(path.join(fliersDir, old));
	for (const [i, { file, data, info }] of made.entries()) {
		const name = `${i + 1}.webp`;
		await writeFile(path.join(fliersDir, name), data);
		console.log(`${name}  ${info.width}x${info.height}  ${Math.round(data.length / 1024)} KB  from ${file}`);
	}
}

// --- The arrangement -------------------------------------------------------------------------

const names = (await readdir(fliersDir).catch(() => []))
	.filter((name) => /\.(webp|jpe?g|png)$/i.test(name))
	.sort((a, b) => a.localeCompare(b));
if (!names.length) {
	console.error('There are no pictures in src/lib/assets/fliers to arrange.');
	process.exit(1);
}

// The same numbers from the same seed, so that an arrangement can be had again.
const seed = seedGiven === undefined ? Math.floor(Math.random() * 1e6) : Number(seedGiven);
let state = (seed >>> 0) || 1;
const random = () => {
	state = (state + 0x6d2b79f5) >>> 0;
	let t = state;
	t = Math.imul(t ^ (t >>> 15), t | 1);
	t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (low, high) => low + (high - low) * random();

// Each sheet's size: the same paper for all, in its picture's proportions.
const sheets = [];
for (const name of names) {
	const { width, height } = await sharp(path.join(fliersDir, name)).metadata();
	const shape = width / height;
	let h = Math.sqrt(PAPER / shape);
	let w = h * shape;
	const fit = Math.min(1, WIDEST / w, TALLEST / h);
	w *= fit;
	h *= fit;
	// None hangs quite straight. Crooked, and turned on its pin, it reaches further than its own
	// width and height: `rw` and `rh` are the half of what it then needs, which is what is kept
	// on the board.
	// Some barely, some a good deal.
	const lean = between(0.02, 0.16) * (random() < 0.5 ? -1 : 1);
	const turn = Math.max(Math.abs(lean), SWING);
	sheets.push({ name, w, h, lean, rw: w / 2 + (h / 2) * turn, rh: h / 2 + (w / 2) * turn });
}
// Which wave, and where everyone's pins are: one at the top in the middle for those that wave,
// which turn on it; and for the rest one at the top and one at the foot, each wherever along the
// edge it happened to go, more often near the middle than not.
const waving = new Set(sheets.map((_, i) => i).sort(() => random() - 0.5).slice(0, WAVING));
const along = (w) => (random() + random() - 1) * 0.36 * w;
sheets.forEach((sheet, i) => {
	sheet.waves = waving.has(i);
	sheet.pins = sheet.waves
		? [{ x: 0, y: sheet.h / 2 - PIN_DOWN }]
		: [
				{ x: along(sheet.w), y: sheet.h / 2 - PIN_DOWN },
				{ x: along(sheet.w), y: PIN_DOWN - sheet.h / 2 }
			];
});

// Anywhere on the board, the end of it behind the rack and the tv included: a board that is
// full has fliers there too, half seen.
const span = ({ rw }) => ({ low: BOARD.left + EDGE + rw, high: BOARD.right - EDGE - rw });
const rise = ({ rh }) => ({ low: BOARD.bottom + EDGE + rh, high: BOARD.top - EDGE - rh });
const within = (value, { low, high }) => Math.min(high, Math.max(low, value));
/** How much of two sheets lies one over the other, taking them as hanging straight. */
function shared(a, b) {
	const across = Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
	const up = Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2);
	return across > 0 && up > 0 ? across * up : 0;
}
/** How much of a sheet is behind the tv, or low down behind the rack. */
function behind(a) {
	const left = a.x - a.w / 2;
	const right = a.x + a.w / 2;
	const tv = Math.max(0, right - Math.max(left, BEHIND_TV)) * a.h;
	const across = Math.min(right, BEHIND_TV) - Math.max(left, BEHIND_RACK.left);
	const up = Math.min(a.y + a.h / 2, BEHIND_RACK.top) - (a.y - a.h / 2);
	return tv + (across > 0 && up > 0 ? across * up : 0);
}

// `order` is who is pinned over whom: later over earlier, and those that wave last of all. What
// an arrangement costs:
// - how much of each sheet is under others, beyond the corner or so that any sheet on a full
//   board is under, squared so that one sheet half hidden is worse than two a quarter hidden;
// - a little for what is behind the rack or the tv, where a sheet is only harder to see: some
//   are to end up there, as they would;
// - far more for a pin that another sheet lies over, or for two that wave being within reach of
//   each other;
// - and for looking arranged: two sheets level with each other, or one straight above another,
//   as sheets in rows and columns are.
const FREE = 0.08;
const LEVEL = 0.11;
const reach = (sheet) => ({ x: sheet.x, y: sheet.y, w: 2 * sheet.rw, h: 2 * sheet.rh });
function cost(at, order) {
	let total = 0;
	const rank = [];
	order.forEach((sheet, place) => (rank[sheet] = place));
	for (let i = 0; i < at.length; i++) {
		let under = 0;
		for (let j = 0; j < at.length; j++) {
			if (j > i) {
				const dx = Math.abs(at[i].x - at[j].x);
				const dy = Math.abs(at[i].y - at[j].y);
				if (dx < 0.75 && dy < LEVEL) total += 0.25 * (1 - dy / LEVEL);
				if (dy < 0.75 && dx < LEVEL) total += 0.25 * (1 - dx / LEVEL);
				if (at[i].waves && at[j].waves) {
					const touching = shared(reach(at[i]), reach(at[j]));
					if (touching) total += 4 + 40 * touching;
				}
			}
			if (rank[j] <= rank[i]) continue;
			under += shared(at[i], at[j]);
			for (const pin of at[i].pins) {
				if (shared({ x: at[i].x + pin.x, y: at[i].y + pin.y, w: PIN_CLEAR * 2, h: PIN_CLEAR * 2 }, at[j])) total += 4;
			}
		}
		const area = at[i].w * at[i].h;
		const lost = behind(at[i]) / area;
		// Partly behind the rack is right; mostly lost behind it is not, nor is that much with what
		// is over it besides.
		total += (4 * Math.max(0, under / area - FREE)) ** 2 + 0.12 * lost + (4 * Math.max(0, lost + under / area - 0.35)) ** 2;
	}
	return total;
}

// Thrown at the board anywhere, then moved about one at a time: a move that hides less is kept,
// and one that hides more is kept now and then, less often as it goes on, so that it does not
// settle into the first tidy rows it finds. Several throws, and the best of them.
function arrange() {
	const at = sheets.map((sheet) => ({ ...sheet, x: between(span(sheet).low, span(sheet).high), y: between(rise(sheet).low, rise(sheet).high) }));
	const shuffled = sheets.map((_, i) => i).sort(() => random() - 0.5);
	let order = [...shuffled.filter((i) => !sheets[i].waves), ...shuffled.filter((i) => sheets[i].waves)];
	let now = cost(at, order);
	const STEPS = 60000;
	for (let step = 0; step < STEPS; step++) {
		const heat = 0.05 * (1 - step / STEPS) ** 2;
		const i = Math.floor(random() * at.length);
		const was = { x: at[i].x, y: at[i].y };
		const before = order;
		if (random() < 0.15) {
			// Only with another of its own kind: those that wave stay over those that do not.
			const kind = at.map((_, n) => n).filter((n) => at[n].waves === at[i].waves);
			const j = kind[Math.floor(random() * kind.length)];
			order = order.slice();
			const a = order.indexOf(i);
			const b = order.indexOf(j);
			[order[a], order[b]] = [order[b], order[a]];
		} else {
			const reach = 0.02 + 0.5 * (1 - step / STEPS);
			at[i].x = within(at[i].x + between(-reach, reach), span(at[i]));
			at[i].y = within(at[i].y + between(-reach, reach), rise(at[i]));
		}
		const then = cost(at, order);
		if (then <= now || random() < Math.exp((now - then) / Math.max(heat, 1e-6))) now = then;
		else {
			at[i].x = was.x;
			at[i].y = was.y;
			order = before;
		}
	}
	return { at, order, cost: now };
}

let best;
for (let throws = 0; throws < 6; throws++) {
	const tried = arrange();
	if (!best || tried.cost < best.cost) best = tried;
}

// How far off the wall each is: just over whatever it lies on. And how much of each shows.
const proud = [];
const showing = [];
for (const [place, i] of best.order.entries()) {
	let level = 0;
	// Hanging crooked, or turned on its pin, a sheet reaches a little past where it is taken to be:
	// one that could so much as touch another is kept clear of it, off the wall.
	for (const j of best.order.slice(0, place)) {
		if (shared(reach(best.at[i]), reach(best.at[j]))) level = Math.max(level, proud[j] + 1);
	}
	proud[i] = level;
	let hidden = behind(best.at[i]);
	for (const j of best.order.slice(place + 1)) hidden += shared(best.at[i], best.at[j]);
	showing[i] = Math.max(0, 1 - hidden / (best.at[i].w * best.at[i].h));
}

const round = (value) => Math.round(value * 1000) / 1000;
// The heads of the pins are whatever came out of the box: all of them bright, no two on a sheet
// the same. Picked last of all, so that an arrangement's seed gives the same places as it did.
const NEON = ['#ff2bd6', '#39ff14', '#00e5ff', '#fff01f', '#ff6a00', '#b026ff', '#ff073a', '#2b6bff'];
const colours = (count) => [...NEON].sort(() => random() - 0.5).slice(0, count);
const fliers = best.at.map((sheet, i) => ({
	x: round(sheet.x),
	up: round(sheet.y),
	lean: round(sheet.lean),
	w: round(sheet.w),
	h: round(sheet.h),
	proud: round(proud[i] * OVER),
	pins: sheet.pins.map((pin, n, all) => ({ x: round(pin.x), y: round(pin.y), color: (all.colours ??= colours(all.length))[n] })),
	waves: sheet.waves
}));
await writeFile(path.join(fliersDir, 'layout.json'), JSON.stringify({ seed, fliers }, null, '\t') + '\n');

console.log(`\nArranged (seed ${seed}). How much of each shows:`);
fliers.forEach((flier, i) => console.log(`  ${names[i]}  ${Math.round(showing[i] * 100)}%${flier.waves ? '  waves' : ''}`));

// --- A picture of it -------------------------------------------------------------------------

const PX = 640; // to one of the room's units
const wide = Math.round((BOARD.right - BOARD.left) * PX);
const tall = Math.round((BOARD.top - BOARD.bottom) * PX);
const layers = [];
for (const i of best.order) {
	const { x, up, lean, w, h } = fliers[i];
	const turned = await sharp(path.join(fliersDir, names[i]))
		.resize(Math.round(w * PX), Math.round(h * PX), { fit: 'fill' })
		.extend({ top: 3, bottom: 3, left: 3, right: 3, background: '#000000' })
		.rotate((-lean * 180) / Math.PI, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.png()
		.toBuffer({ resolveWithObject: true });
	layers.push({
		input: turned.data,
		left: Math.round((x - BOARD.left) * PX - turned.info.width / 2),
		top: Math.round((BOARD.top - up) * PX - turned.info.height / 2)
	});
}
// The pins, in their colours, and a ring round those of the fliers that wave.
const dots = fliers
	.flatMap((flier) =>
		flier.pins.map((pin) => {
			const cx = (flier.x + pin.x * Math.cos(flier.lean) - pin.y * Math.sin(flier.lean) - BOARD.left) * PX;
			const cy = (BOARD.top - (flier.up + pin.x * Math.sin(flier.lean) + pin.y * Math.cos(flier.lean))) * PX;
			const ring = flier.waves ? `<circle cx="${cx}" cy="${cy}" r="18" fill="none" stroke="#fff" stroke-width="3"/>` : '';
			return `${ring}<circle cx="${cx}" cy="${cy}" r="9" fill="${pin.color}" stroke="#000" stroke-width="2"/>`;
		})
	)
	.join('');
// What stands in front of the board, as near as it is known here.
const shade = (left, top, right, bottom) =>
	`<rect x="${(left - BOARD.left) * PX}" y="${(BOARD.top - top) * PX}" width="${(right - left) * PX}" height="${(top - bottom) * PX}" fill="#000" fill-opacity="0.55"/>`;
layers.push({
	input: Buffer.from(
		`<svg width="${wide}" height="${tall}" xmlns="http://www.w3.org/2000/svg">${shade(BEHIND_TV, BOARD.top, BOARD.right, BOARD.bottom)}${shade(BEHIND_RACK.left, BEHIND_RACK.top, BEHIND_TV, BOARD.bottom)}${dots}</svg>`
	),
	left: 0,
	top: 0
});
await mkdir(previewDir, { recursive: true });
const preview = path.join(previewDir, 'board-preview.png');
await sharp({ create: { width: wide, height: tall, channels: 3, background: '#8a5a33' } })
	.composite(layers)
	.png()
	.toFile(preview);
console.log(`\nA picture of the board as arranged: ${path.relative(root, preview)}`);
