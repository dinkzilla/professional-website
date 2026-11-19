// The printing of the manual that is in the game's box (see items.ts, which makes the booklet):
// its cover, in the box's own black and gold, and its pages, which are white, as the site they are
// about is. What the pages say is in the catalogue. Every page sends its reader to the site: in
// what it says, and in a black band along its foot, and each mention of the address is a link.

import manrope from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url';
import martian from '@fontsource-variable/martian-mono/files/martian-mono-latin-wght-normal.woff2?url';
import lidArt from '#lib/assets/mothership-lid.jpg';
import type { Block, Figure, Manual, ManualPage, Point } from './catalogue.ts';
import type { Link } from './items.ts';

/** A page's proportions, and how many px it is printed at. */
export const PAGE = { W: 1200, H: 1680 };
const { W, H } = PAGE;

const SANS_FACE = 'Manual Manrope';
const MONO_FACE = 'Manual Martian';
const SANS = `'${SANS_FACE}', system-ui, sans-serif`;
const MONO = `'${MONO_FACE}', ui-monospace, monospace`;
// The face the site sets its name in, which the box's lettering has fetched (see loadPrinting).
const DISPLAY = `Monoton, system-ui, sans-serif`;
const sans = (px: number, weight = 500) => `${weight} ${px}px ${SANS}`;
const mono = (px: number, weight = 600) => `${weight} ${px}px ${MONO}`;

const PAPER = '#f3f1ea';
const INK = '#111113';
const SOFT = '#2c2c30'; // the ink of what is not the first thing to be read
const FAINT = '#6a675f';
const TINT = '#e5e1d4'; // paper with something laid on it
const OCHRE = '#9a7412'; // the box's gold, as dark as it has to be to show on white
const BLACK = '#070708';
const GOLD = '#c9b27c';
const WHITE = '#f1efe9';

const EDGE = 92; // the margin either side
const WIDE = W - 2 * EDGE;
const BAND = 128; // the black band along the foot of a page
const TOP = 158; // where a page's own matter starts, under its running head
const FOOT = H - BAND - 46; // and where it has to stop

// The screenshots: whatever pictures are in the assets' manual folder, by the number each is named.
const shots = Object.entries(
	import.meta.glob<string>('../assets/manual/*.{jpg,jpeg,png,webp}', {
		eager: true,
		query: '?url',
		import: 'default'
	})
).map(([path, url]) => ({ n: parseInt(path.split('/').pop()!, 10), url }));
const art = new Map<number, HTMLImageElement>();
let lid: HTMLImageElement | undefined;

/** Fetch what the manual is printed with. Whatever cannot be had is done without. */
export async function loadManual() {
	const faces = [
		new FontFace(SANS_FACE, `url(${manrope})`, { weight: '200 800' }),
		new FontFace(MONO_FACE, `url(${martian})`, { weight: '100 800' })
	];
	const cover = Object.assign(new Image(), { src: lidArt });
	await Promise.allSettled([
		...faces.map((face) => face.load().then((loaded) => document.fonts.add(loaded))),
		cover.decode().then(() => (lid = cover)),
		...shots.map(({ n, url }) => {
			const shot = Object.assign(new Image(), { src: url });
			return shot.decode().then(() => art.set(n, shot));
		})
	]);
}

type Context = CanvasRenderingContext2D;

function sheet() {
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const c = canvas.getContext('2d')!;
	c.textBaseline = 'alphabetic';
	return { canvas, c };
}

/** Type in one face, with its letters this far apart. */
function type(c: Context, font: string, tracking = 0, align: CanvasTextAlign = 'left') {
	c.font = font;
	c.letterSpacing = `${tracking}px`;
	c.textAlign = align;
}

/** The size at which `text` is no wider than `width`, and no larger than `most`. */
function fitted(c: Context, text: string, font: (px: number) => string, width: number, most: number, tracking = 0) {
	type(c, font(100), (tracking * 100) / most);
	return Math.min(most, (100 * width) / c.measureText(text).width);
}

/** An arrow pointing up and to the right, as on a link that goes somewhere else: `s` across. */
function away(c: Context, x: number, y: number, s: number, color: string) {
	c.strokeStyle = color;
	c.lineWidth = s * 0.16;
	c.lineCap = 'butt';
	c.lineJoin = 'miter';
	c.beginPath();
	c.moveTo(x, y + s);
	c.lineTo(x + s, y);
	c.moveTo(x + s * 0.28, y);
	c.lineTo(x + s, y);
	c.lineTo(x + s, y + s * 0.72);
	c.stroke();
}

/** A chevron `s` tall, pointing right (1) or left (-1), its point at `x`. */
function chevron(c: Context, x: number, y: number, s: number, way: 1 | -1, color: string) {
	c.strokeStyle = color;
	c.lineWidth = s * 0.2;
	c.lineCap = 'butt';
	c.lineJoin = 'miter';
	c.beginPath();
	c.moveTo(x - way * s * 0.5, y - s / 2);
	c.lineTo(x, y);
	c.lineTo(x - way * s * 0.5, y + s / 2);
	c.stroke();
}

/**
 * The booklet's cover: the drawing on the box's lid, with a black plate across it where the box
 * has its mark, for the name of the thing, what it is, and where it is to be found.
 */
function cover(manual: Manual) {
	const { canvas, c } = sheet();
	const links: Link[] = [];
	c.fillStyle = BLACK;
	c.fillRect(0, 0, W, H);
	if (lid) {
		// As it is on the box, whose lid is this shape: enlarged from its middle by enough to lose
		// what is printed round the real lid's edge.
		const ZOOM = 1.19;
		c.drawImage(lid, (W * (1 - ZOOM)) / 2, (H * (1 - ZOOM)) / 2, W * ZOOM, H * ZOOM);
	}
	const inset = 64;
	const plate = { top: H * 0.285, bottom: H * 0.735 };
	c.fillStyle = BLACK;
	c.fillRect(inset, plate.top, W - 2 * inset, plate.bottom - plate.top);
	c.strokeStyle = WHITE;
	c.lineWidth = 5;
	c.strokeRect(inset, inset, W - 2 * inset, H - 2 * inset);
	c.strokeRect(inset, plate.top, W - 2 * inset, plate.bottom - plate.top);

	const middle = W / 2;
	let y = plate.top + 104;
	type(c, mono(25, 700), 11, 'center');
	c.fillStyle = GOLD;
	c.fillText(manual.kind.toUpperCase(), middle + 5, y);

	// The name, in the face the site sets it in: all fine stripes, and as wide as the plate allows.
	const name = manual.title.toUpperCase();
	const display = (px: number) => `${px}px ${DISPLAY}`;
	const size = fitted(c, name, display, W - 2 * inset - 150, 190);
	type(c, display(size), 0, 'center');
	y += size * 1.12;
	c.fillStyle = WHITE;
	c.fillText(name, middle, y);

	y += 62;
	c.fillStyle = GOLD;
	c.fillRect(middle - 70, y, 140, 4);

	type(c, sans(37, 500), 0, 'center');
	c.fillStyle = WHITE;
	y += 28;
	for (const row of broken(c, manual.tagline, 720, () => sans(37, 500))) {
		y += 52;
		c.fillText(row.join(' '), middle, y);
	}

	// Where it is: on a gold plate of its own, which is a link.
	const address = manual.site.name.toUpperCase();
	type(c, mono(33, 800), 4, 'center');
	const across = c.measureText(address).width + 150;
	const chip = { x: middle - across / 2, y: y + 62, w: across, h: 84 };
	c.fillStyle = GOLD;
	c.fillRect(chip.x, chip.y, chip.w, chip.h);
	c.fillStyle = BLACK;
	c.fillText(address, middle - 20, chip.y + 55);
	away(c, chip.x + chip.w - 66, chip.y + 30, 24, BLACK);
	links.push(linked(manual, chip.x, chip.y, chip.w, chip.h));

	// How it is opened, on a tab that breaks the frame's bottom line.
	const hint = 'TAP TO OPEN';
	type(c, mono(20, 700), 6, 'center');
	const tab = c.measureText(hint).width + 130;
	c.fillStyle = BLACK;
	c.fillRect(middle - tab / 2, H - inset - 28, tab, 56);
	c.fillStyle = WHITE;
	c.fillText(hint, middle - 12, H - inset + 8);
	chevron(c, middle + tab / 2 - 44, H - inset, 20, 1, GOLD);
	c.letterSpacing = '0px';
	return { canvas, links };
}

/** The part of a page that is a link to the site: this rectangle of it, in px. */
function linked(manual: Manual, x: number, y: number, w: number, h: number): Link {
	return { href: manual.site.href, u: [x / W, (x + w) / W], v: [1 - (y + h) / H, 1 - y / H] };
}

/**
 * `text` broken into lines of words no wider than `width`, where each word is set in the font
 * that `face` gives for it. A word is not left on the last line by itself if the line before can
 * spare one to go with it.
 */
function broken(c: Context, text: string, width: number, face: (word: string) => string) {
	const wide = (word: string) => {
		c.font = face(word);
		return c.measureText(word).width;
	};
	c.font = face('');
	const space = c.measureText(' ').width;
	const rows: string[][] = [[]];
	let used = 0;
	for (const word of text.split(' ')) {
		const row = rows[rows.length - 1];
		const takes = wide(word);
		if (row.length && used + space + takes > width) {
			rows.push([word]);
			used = takes;
		} else {
			used += (row.length ? space : 0) + takes;
			row.push(word);
		}
	}
	const last = rows[rows.length - 1];
	const before = rows[rows.length - 2];
	if (last.length === 1 && before && before.length > 3) last.unshift(before.pop()!);
	return rows;
}

/** One of the manual's pages, the `n`th of `count`: its matter, under a running head and over the band. */
function page(manual: Manual, content: ManualPage, n: number, count: number, numbering: { figure: number }) {
	const { canvas, c } = sheet();
	let links: Link[] = [];
	const site = manual.site.name.toLowerCase();
	const names = (word: string) => word.toLowerCase().includes(site);

	/**
	 * A paragraph, ragged on the right, its top at `y`: how tall it came out. Wherever it names the
	 * site, the name is heavier, underlined in gold, and a link.
	 */
	const para = (text: string, x: number, y: number, width: number, size: number, leading: number, color = SOFT, weight = 500) => {
		const face = (word: string) => sans(size, names(word) ? 800 : weight);
		type(c, face(''));
		const space = c.measureText(' ').width;
		const rows = broken(c, text, width, face);
		rows.forEach((row, at) => {
			const base = y + size * 0.8 + at * leading;
			let wx = x;
			for (const word of row) {
				c.font = face(word);
				const takes = c.measureText(word).width;
				if (names(word)) {
					// Whatever punctuation follows the name is not part of it.
					const [, name, rest] = word.match(/^(.*?)([.,:;!?]*)$/)!;
					const named = c.measureText(name).width;
					c.fillStyle = INK;
					c.fillText(name, wx, base);
					c.fillStyle = OCHRE;
					c.fillRect(wx, base + size * 0.16, named, Math.max(3, size * 0.09));
					c.fillStyle = color;
					c.fillText(rest, wx + named, base);
					links.push(linked(manual, wx - 10, base - size - 6, named + 20, size + 24));
				} else {
					c.fillStyle = color;
					c.fillText(word, wx, base);
				}
				wx += takes + space;
			}
		});
		return (rows.length - 1) * leading + size * 1.06;
	};

	/** A label: small capitals in the typewriter face, on the baseline `y`. */
	const label = (text: string, x: number, y: number, color = INK, size = 21) => {
		type(c, mono(size, 700), size * 0.14);
		c.fillStyle = color;
		c.fillText(text.toUpperCase(), x, y);
		const wide = c.measureText(text.toUpperCase()).width;
		c.letterSpacing = '0px';
		return wide;
	};

	/** How wide a picture is for its height: of the part of it that is shown. */
	const shape = (figure: Figure) => {
		const from = art.get(figure.art);
		const [, , w, h] = figure.crop ?? [0, 0, 1, 1];
		return from ? (from.naturalWidth * w) / (from.naturalHeight * h) : 1.6;
	};

	/** A picture, in a keyline, standing a little off the page. Its caption is under it, if wanted. */
	const picture = (figure: Figure, x: number, y: number, w: number, h: number, captioned = true) => {
		const from = art.get(figure.art);
		c.fillStyle = 'rgb(17 17 19 / 0.16)';
		c.fillRect(x + 12, y + 12, w, h);
		if (from) {
			const [cx, cy, cw, ch] = figure.crop ?? [0, 0, 1, 1];
			c.imageSmoothingQuality = 'high';
			c.drawImage(
				from,
				cx * from.naturalWidth,
				cy * from.naturalHeight,
				cw * from.naturalWidth,
				ch * from.naturalHeight,
				x,
				y,
				w,
				h
			);
		} else {
			c.fillStyle = '#c9c6bc';
			c.fillRect(x, y, w, h);
		}
		c.strokeStyle = INK;
		c.lineWidth = 3;
		c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
		if (!captioned) return h;
		const number = `Fig. ${numbering.figure++}`;
		// As small as it takes to go under its picture on one line.
		type(c, mono(19, 700), 2.7);
		const tag = c.measureText(`${number.toUpperCase()}  `).width;
		type(c, mono(19, 500), 2.7);
		const size = Math.min(19, (19 * (w - tag)) / c.measureText(figure.caption.toUpperCase()).width);
		const at = x + label(number, x, y + h + 44, OCHRE, size);
		type(c, mono(size, 500), size * 0.14);
		c.fillStyle = SOFT;
		c.fillText(figure.caption.toUpperCase(), at + size, y + h + 44);
		c.letterSpacing = '0px';
		return h + 56;
	};

	/** A name over what is said about it, under a heavy rule: one of several side by side. */
	const column = (point: Point, x: number, y: number, w: number, size: number) => {
		c.fillStyle = INK;
		c.fillRect(x, y, w, 5);
		label(point.label, x, y + 48);
		return 72 + para(point.text, x, y + 72, w, size, size * 1.42);
	};

	// Each kind of thing on a page: printed with its top at `y`, it says how tall it came out.
	const print: { [K in Block['kind']]: (block: Extract<Block, { kind: K }>, y: number) => number } = {
		text: (block, y) =>
			block.lead
				? para(block.text, EDGE, y, WIDE, 39, 56, INK)
				: para(block.text, EDGE, y, WIDE, 34, 50),
		figure: (block, y) => picture(block.figure, EDGE, y, WIDE, WIDE / shape(block.figure)),
		pair: (block, y) => {
			const gap = 40;
			const [a, b] = block.figures.map(shape);
			const h = (WIDE - gap) / (a + b);
			picture(block.figures[0], EDGE, y, a * h, h);
			return picture(block.figures[1], EDGE + a * h + gap, y, b * h, h);
		},
		steps: (block, y) => {
			// A numeral in the site's own face to each, and a fine rule between one and the next.
			const NUMERAL = 142;
			const from = y;
			block.steps.forEach((step, at) => {
				if (at) {
					c.fillStyle = 'rgb(17 17 19 / 0.22)';
					c.fillRect(EDGE, y, WIDE, 2);
					y += 34;
				}
				type(c, `104px ${DISPLAY}`);
				c.fillStyle = OCHRE;
				c.fillText(String(at + 1), EDGE - 4, y + 92);
				type(c, sans(40, 800), -0.6);
				c.fillStyle = INK;
				c.fillText(step.label, EDGE + NUMERAL, y + 40);
				c.letterSpacing = '0px';
				y += Math.max(104, 62 + para(step.text, EDGE + NUMERAL, y + 62, WIDE - NUMERAL, 33, 48)) + 30;
			});
			return y - 30 - from;
		},
		rows: (block, y) => {
			const across = 400;
			const gap = 44;
			const from = y;
			for (const row of block.rows) {
				const h = across / shape(row.figure);
				picture(row.figure, EDGE, y, across, h, false);
				const x = EDGE + across + gap;
				c.fillStyle = INK;
				c.fillRect(x, y, WIDE - across - gap, 5);
				label(row.label, x, y + 46);
				const tall = 68 + para(row.text, x, y + 68, WIDE - across - gap, 31, 44);
				y += Math.max(h + 12, tall) + 38;
			}
			return y - 38 - from;
		},
		note: (block, y) => {
			const pad = 34;
			const bar = 12;
			const inner = WIDE - bar - 2 * pad;
			// Its ground goes down first, which takes knowing how tall it is: so it is set twice.
			const tall = () => 2 * pad + 44 + para(block.note.text, EDGE + bar + pad, y + pad + 44, inner, 32, 46);
			const h = tall();
			c.fillStyle = TINT;
			c.fillRect(EDGE, y, WIDE, h);
			c.fillStyle = OCHRE;
			c.fillRect(EDGE, y, bar, h);
			label(block.note.label, EDGE + bar + pad, y + pad + 20, OCHRE);
			tall();
			return h;
		},
		columns: (block, y) => {
			const gap = 44;
			const each = (WIDE - gap * (block.columns.length - 1)) / block.columns.length;
			const size = block.columns.length > 2 ? 29 : 32;
			return Math.max(...block.columns.map((point, at) => column(point, EDGE + at * (each + gap), y, each, size)));
		},
		list: (block, y) => {
			const margin = 290;
			const from = y;
			for (const point of block.list) {
				c.fillStyle = INK;
				c.fillRect(EDGE, y, WIDE, 3);
				label(point.label, EDGE, y + 52);
				y += 26 + para(point.text, EDGE + margin, y + 26, WIDE - margin, 33, 48) + 20;
			}
			c.fillStyle = INK;
			c.fillRect(EDGE, y, WIDE, 3);
			return y + 3 - from;
		},
		call: (block, y) => {
			// A black plate, as on the cover, with the address as large as goes across it.
			const pad = 46;
			const address = manual.site.name.toUpperCase();
			const display = (px: number) => `${px}px ${DISPLAY}`;
			const size = fitted(c, address, display, WIDE - 2 * pad, 150);
			const under = () => para(block.under, EDGE + pad, y + pad + 52 + size * 1.2, WIDE - 2 * pad, 27, 39, GOLD);
			const h = pad + 52 + size * 1.2 + under() + pad - 8;
			c.fillStyle = BLACK;
			c.fillRect(EDGE, y, WIDE, h);
			label(block.over, EDGE + pad, y + pad + 22, GOLD, 22);
			away(c, EDGE + WIDE - pad - 28, y + pad, 28, GOLD);
			type(c, display(size));
			c.fillStyle = WHITE;
			c.fillText(address, EDGE + pad - size * 0.03, y + pad + 40 + size);
			under();
			links.push(linked(manual, EDGE, y, WIDE, h));
			return h;
		}
	};

	/** The page's number on a black tab, what part of the manual it is, and its headline under them. */
	const heading = (y: number) => {
		c.fillStyle = INK;
		c.fillRect(EDGE, y, 70, 46);
		type(c, mono(23, 700), 1, 'center');
		c.fillStyle = WHITE;
		c.fillText(String(n).padStart(2, '0'), EDGE + 35.5, y + 32);
		c.textAlign = 'left';
		label(content.section, EDGE + 92, y + 31, INK, 22);
		// On one line, as large as goes; on two only if that would make it small.
		const face = (px: number) => sans(px, 800);
		let size = fitted(c, content.headline, face, WIDE, 86, -2.4);
		let rows = [content.headline.split(' ')];
		if (size < 66) {
			size = 74;
			type(c, face(size), -2);
			rows = broken(c, content.headline, WIDE, () => face(size));
		}
		type(c, face(size), size * -0.028);
		c.fillStyle = INK;
		rows.forEach((row, at) => c.fillText(row.join(' '), EDGE - size * 0.04, y + 78 + size * 0.8 + at * size * 1.04));
		c.letterSpacing = '0px';
		return 78 + size * (0.8 + 1.04 * (rows.length - 1)) + 48;
	};

	/** What is on every page: the running head, and the band that says where the site is. */
	const furniture = () => {
		c.fillStyle = PAPER;
		c.fillRect(0, 0, W, H);
		label(manual.title, EDGE, 86, INK, 21);
		type(c, mono(19, 500), 3.4, 'right');
		c.fillStyle = FAINT;
		c.fillText(manual.kind.toUpperCase(), W - EDGE + 3.4, 86);
		c.textAlign = 'left';
		c.fillStyle = INK;
		c.fillRect(EDGE, 106, WIDE, 4);

		const top = H - BAND;
		c.fillStyle = BLACK;
		c.fillRect(0, top, W, BAND);
		const base = top + 77;
		let x = EDGE + label('Free to use at', EDGE, base - 3, GOLD, 19) + 24;
		type(c, mono(35, 800), 2.5);
		const address = manual.site.name.toUpperCase();
		c.fillStyle = WHITE;
		c.fillText(address, x, base);
		x += c.measureText(address).width + 14;
		away(c, x, base - 26, 22, GOLD);
		links.push(linked(manual, EDGE - 20, top + 14, x + 22 + 40 - EDGE, BAND - 28));

		// Which page this is of how many, between the ways to the one before and the one after.
		const where = `${n} / ${count}`;
		type(c, mono(22, 600), 2, 'center');
		const mid = W - EDGE - 84;
		c.fillStyle = WHITE;
		c.fillText(where, mid + 1, base - 2);
		chevron(c, mid - 70, base - 10, 22, -1, GOLD);
		if (n < count) chevron(c, mid + 70, base - 10, 22, 1, GOLD);
		c.textAlign = 'left';
		c.letterSpacing = '0px';
	};

	// The page is set twice: once to find how tall each thing on it comes out, and again with what
	// room is over shared out between them. Whatever calls the reader to the site goes at the foot.
	const GAP = 38;
	const first = numbering.figure;
	const set = (spread: number, foot?: number) => {
		links = [];
		numbering.figure = first;
		furniture();
		let y = TOP + heading(TOP);
		let gaps = 0;
		let last = 0;
		content.blocks.forEach((block, at) => {
			// One paragraph under another is kept close to it.
			const close = block.kind === 'text' && content.blocks[at - 1]?.kind === 'text';
			if (at) y += close ? 24 : GAP + spread;
			if (at && !close) gaps++;
			const anchored = foot !== undefined && block.kind === 'call' && at === content.blocks.length - 1;
			if (anchored) y = Math.max(y, FOOT - foot);
			last = (print[block.kind] as (block: Block, y: number) => number)(block, y);
			y += last;
		});
		return { used: y, gaps, last };
	};
	const { used, gaps, last } = set(0);
	const spare = FOOT - used;
	if (spare < 0 && import.meta.env.DEV) console.warn(`manual page ${n} is ${Math.round(-spare)}px too long`);
	set(Math.max(-12, Math.min(46, spare / Math.max(1, gaps))), last);
	return { canvas, links };
}

/**
 * The back of a leaf, which is seen only as it is turned: the site's mark and its address, in the
 * middle of an otherwise empty page.
 */
function verso(manual: Manual) {
	const { canvas, c } = sheet();
	c.fillStyle = PAPER;
	c.fillRect(0, 0, W, H);
	c.strokeStyle = 'rgb(17 17 19 / 0.5)';
	c.lineWidth = 3;
	c.strokeRect(EDGE, EDGE, WIDE, H - 2 * EDGE);
	type(c, `330px ${DISPLAY}`, 0, 'center');
	c.fillStyle = INK;
	c.fillText(manual.title[0].toUpperCase(), W / 2, H / 2 + 60);
	type(c, mono(27, 700), 5, 'center');
	c.fillStyle = OCHRE;
	c.fillText(manual.site.name.toUpperCase(), W / 2 + 2.5, H / 2 + 170);
	c.textAlign = 'left';
	c.letterSpacing = '0px';
	return canvas;
}

/**
 * The manual, printed: the face of each of its leaves in order, the cover first, each with where
 * on it the links are, and the one back that all the leaves have.
 */
export function printManual(manual: Manual) {
	const numbering = { figure: 1 };
	return {
		faces: [cover(manual), ...manual.pages.map((each, at) => page(manual, each, at + 1, manual.pages.length, numbering))],
		back: verso(manual)
	};
}
