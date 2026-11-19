// The Triceratops skull, the newspaper clipping rolled up in its eye socket, and the books that
// lean on it.

import {
	BufferGeometry,
	CanvasTexture,
	CylinderGeometry,
	Float32BufferAttribute,
	Group,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	Quaternion,
	RepeatWrapping,
	SRGBColorSpace,
	TextureLoader,
	Vector3
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import frauncesItalic from '@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2?url';
import fraunces from '@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2?url';
import skullShade from '#lib/assets/models/skull-ao.webp';
import skullNormal from '#lib/assets/models/skull-normal.webp';
import skullMesh from '#lib/assets/models/skull.glb?url';
import { catalogue, type Article } from '../catalogue.ts';
import { light, mid, dark, accent, page, mesh, box, horn, smooth, printed } from '../parts.ts';
import { RACK_DEPTH } from '../rack.ts';
import type { Placement, Link, Works } from '../types.ts';

// The skull as scanned, once fetched: a Triceratops skull without its lower jaw, a unit long from
// beak to frill, facing forward (+z) and rocked back onto its frill, with its base centred on the
// origin. Made from the model in model-originals/triceratops (Creative Commons 4.0).
let skullModel: { geometry: BufferGeometry; bone: MeshStandardMaterial } | undefined;

/**
 * Fetch the objects that are scanned models and not built here from primitives, which is to be
 * done before any object is built. One that cannot be had is left as its grey-box stand-in.
 */
export async function loadModels() {
	const textures = new TextureLoader();
	// Laid out for the model's own texture coordinates, which run the other way up from three's.
	const texture = async (url: string) => {
		const t = await textures.loadAsync(url);
		t.flipY = false;
		t.anisotropy = 8;
		return t;
	};
	try {
		const [gltf, normalMap, shade] = await Promise.all([
			new GLTFLoader().loadAsync(skullMesh),
			texture(skullNormal),
			texture(skullShade)
		]);
		const found = gltf.scene.getObjectByProperty('isMesh', true) as Mesh | undefined;
		if (!found) return;
		// The shading baked into the hollows is its only colouring, over the colour of old bone. The
		// fine surface the scan had, and this many triangles cannot hold, is in the normal map.
		shade.colorSpace = SRGBColorSpace;
		// The model rests on its teeth, which is how it stands on the shelf. Centred over its base.
		const geometry = found.geometry;
		geometry.computeBoundingBox();
		const { min, max } = geometry.boundingBox!;
		geometry.translate(-(min.x + max.x) / 2, -min.y, -(min.z + max.z) / 2);
		skullModel = {
			geometry,
			bone: new MeshStandardMaterial({ color: 0xd6ccb4, roughness: 0.85, map: shade, normalMap })
		};
	} catch {
		// The stand-in will do.
	}
}

// The newspaper clipping rolled up in the skull's left eye socket, which is the one that faces out
// of the shelf. When the skull is picked up, it slides out of the socket and unrolls to be read.
//
// Where the roll goes is given in the scanned skull's own units: its axis passes through `at`, in
// the middle of the socket, and points out, a little up and nearly as far forward, toward the
// beak, as it does out. It goes `inside` into the skull from there and stands `outside` out of it.
// `r` is all the socket has room for, so the roll is squeezed where it goes in and has sprung
// open outside it: wider by `flare` at its outer end. `spin` turns it about its axis, which
// decides where round it the loose edge of the sheet lies.
const ROLL = {
	at: new Vector3(0.1, 0.274, 0.046),
	toward: new Vector3(1, 0.4, 0.9).normalize(),
	inside: 0.08,
	outside: 0.22,
	r: 0.024,
	core: 0.007,
	turns: 5,
	flare: 0.45,
	spin: 2.4
};

/**
 * Where a point of the clipping is when the sheet is `k` of the way unrolled (0 rolled up, 1
 * flat), in the sheet's own frame: flat, it faces +z with its middle on the origin, as wide as
 * the roll is long. The point is `s` down the sheet from its top edge and `w` in from its left.
 *
 * It unrolls as a scroll does. The top of the sheet lies flat, as far down as has been let out,
 * and the rest is still rolled, print inward, in a roll that sits on the face of the sheet at
 * that line and gets thinner as it gives up paper. The sheet's foot is at the roll's core. What
 * makes the roll less than perfect is all measured out from the paper's own surface, so that it
 * carries over from the rolled part to the flat with no step, and fades as the sheet unrolls.
 */
function clippingPoint(s: number, w: number, k: number, to: Vector3) {
	const { W, L, core, gap, inside, outside } = SHEET;
	const out = k * L; // how far down the sheet is flat
	const fade = 1 - k;
	const a = L - s; // how far this is from the core, along the paper
	// The winding is not even: the paper stands off its true line by a little, more so the further
	// out it is. And the loose edge has lifted off the roll, most at its outer corner.
	const uneven = (0.0003 + (0.0005 * a) / L) * (0.6 * Math.sin(a / 0.021 + 1) + 0.4 * Math.sin(a / 0.013 + 4));
	const flap = 0.005 * Math.max(0, 1 - s / 0.035) ** 2 * (0.35 + (0.65 * w) / W);
	const off = fade * (uneven + flap);
	// Sprung open past the socket, by the same share at every turn.
	const open = 1 + (ROLL.flare * fade * Math.max(0, w - inside)) / outside;
	const x = w - W / 2;
	if (s <= out) return to.set(x, L / 2 - s, -open * off);
	// A spiral that takes up `gap` with every turn: how far out the paper is this far from the
	// core, and how far round.
	const radius = (arc: number) => Math.sqrt(core * core + (arc * gap) / Math.PI);
	const round = (arc: number) => ((radius(arc) - core) * 2 * Math.PI) / gap;
	const rolled = L - out; // how much paper is still in the roll
	const turn = round(rolled) - round(a);
	const r = radius(a) + off;
	// The inner turns stand a little further out of the roll's end than the outer ones.
	const proud = (0.012 * fade * (rolled - a)) / L;
	return to.set(x + proud, L / 2 - out - open * r * Math.sin(turn), open * (radius(rolled) - r * Math.cos(turn)));
}

/**
 * A blank sheet of newsprint to print the clipping on, one side of it: cut out of the paper with
 * scissors, not quite square. The other side is the same shape seen from behind (`mirrored`).
 * Nothing drawn after this goes outside the cut.
 */
function newsprint(mirrored: boolean) {
	const canvas = document.createElement('canvas');
	const W = (canvas.width = SHEET.PX);
	const H = (canvas.height = Math.round((SHEET.PX * SHEET.L) / SHEET.W));
	const c = canvas.getContext('2d')!;
	const cut = [
		[0.012, 0.004],
		[0.996, 0],
		[0.986, 0.52],
		[0.997, 0.994],
		[0.002, 1],
		[0.009, 0.44]
	];
	c.beginPath();
	for (const [x, y] of cut) c.lineTo((mirrored ? 1 - x : x) * W, y * H);
	c.closePath();
	c.clip();
	c.fillStyle = '#dddcd6';
	c.fillRect(0, 0, W, H);
	return { canvas, c, W, H };
}

/**
 * What being rolled up has left in the paper, drawn over the print: faint lines across it where
 * it was pressed flat, closer together toward its foot, which was wound the tightest.
 */
function creased(c: CanvasRenderingContext2D, W: number, H: number) {
	let seed = 11;
	const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
	for (let y = H * 0.06; y < H; y += H * (0.02 + 0.07 * random()) * (1.25 - y / H)) {
		const tilt = (random() - 0.5) * H * 0.006;
		for (const [shade, dy] of [
			['rgb(0 0 0 / 0.045)', 0],
			['rgb(255 255 255 / 0.12)', 2.5]
		] as const) {
			c.strokeStyle = shade;
			c.lineWidth = 2;
			c.beginPath();
			c.moveTo(0, y + dy - tilt);
			c.lineTo(W, y + dy + tilt);
			c.stroke();
		}
	}
}

const INK = '#22211f';
// The face the clipping is set in, once fetched (see loadPrinting), and what stands in for it.
const NEWS_FACE = 'Clipping Fraunces';
const SERIF = `'${NEWS_FACE}', Georgia, 'Times New Roman', serif`;

/** `text` broken into lines of words no wider than `width`, in the font that is set. */
function lines(c: CanvasRenderingContext2D, text: string, width: number, indent = 0) {
	const out: string[][] = [[]];
	let room = width - indent;
	let used = 0;
	const space = c.measureText(' ').width;
	for (const word of text.split(' ')) {
		const wide = c.measureText(word).width;
		const line = out[out.length - 1];
		if (line.length && used + space + wide > room) {
			out.push([word]);
			room = width;
			used = wide;
		} else {
			used += (line.length ? space : 0) + wide;
			line.push(word);
		}
	}
	return out;
}

/**
 * `text` broken into as few lines as `lines` makes of it, but of about the same length, so that
 * no word is left on a line by itself.
 */
function evenLines(c: CanvasRenderingContext2D, text: string, width: number) {
	let out = lines(c, text, width);
	for (let w = width; w > width / 2; w -= width / 64) {
		const narrower = lines(c, text, w);
		if (narrower.length > out.length) break;
		out = narrower;
	}
	return out;
}

/**
 * `text` broken into lines that are to be spread to `width`, all but the last. The breaks are the
 * ones that leave the spaces nearest their own size over the whole paragraph, which filling each
 * line as it comes does not: that sets a tight line and then a gappy one.
 */
function spreadLines(c: CanvasRenderingContext2D, text: string, width: number, indent = 0) {
	const words = text.split(' ');
	const wide = words.map((word) => c.measureText(word).width);
	const space = c.measureText(' ').width;
	// From each word, the least that setting the rest costs, and where its line ends to do so.
	const cost = words.map(() => Infinity).concat(0);
	const end = words.map(() => words.length);
	for (let from = words.length - 1; from >= 0; from--) {
		const room = width - (from ? 0 : indent);
		let taken = 0;
		for (let to = from + 1; to <= words.length; to++) {
			taken += wide[to - 1];
			const gaps = to - from - 1;
			// How many times its own size each space would be.
			const each = gaps ? (room - taken) / gaps / space : Infinity;
			if (gaps && each < 0.82) break;
			const last = to === words.length;
			if (last && each < 1) break;
			// A space squeezed shows sooner than one let out, and the last line is not spread at all.
			// A word by itself on a line is the last resort.
			const bad = last ? (gaps ? 0 : 2) : each < 1 ? (4 * (1 - each)) ** 2 : Math.min(1000, (each - 1) ** 2);
			if (bad + cost[to] < cost[from]) [cost[from], end[from]] = [bad + cost[to], to];
		}
	}
	const out: string[][] = [];
	for (let from = 0; from < words.length; from = end[from]) out.push(words.slice(from, end[from]));
	return out;
}

/**
 * The side of the clipping that was cut out to be kept: the article's headline over what it is
 * about and whose it is, its photograph, and as much of its opening as there is paper for, in two
 * columns, down to the foot.
 */
function clippingFront(article: Article) {
	const { canvas, c, W, H } = newsprint(false);
	const edge = W * 0.06;
	const wide = W - 2 * edge;
	const hair = Math.max(1.5, W * 0.0018);
	c.fillStyle = INK;
	c.textBaseline = 'alphabetic';
	const rule = (at: number, thick = hair) => c.fillRect(edge, at, wide, thick);

	// The headline, under the rule that parted it from the story above: as large as goes on two
	// lines, and on more only if that would make it small. Its lines are the same length.
	let y = edge * 0.62;
	rule(y, W * 0.007);
	y += W * 0.007 + W * 0.012;
	let head = W * 0.125;
	const heading = () => {
		c.font = `900 ${head}px ${SERIF}`;
		return lines(c, article.headline, wide);
	};
	while (head > W * 0.05 && (heading().length > 2 || c.measureText(article.headline).width > wide * 1.96)) head -= 1;
	heading();
	for (const line of evenLines(c, article.headline, wide)) {
		y += head * 1.08;
		c.fillText(line.join(' '), edge, y);
	}

	// Under it, what the article is about.
	const stand = W * 0.0325;
	c.font = `italic 400 ${stand}px ${SERIF}`;
	y += stand * 0.5;
	for (const line of evenLines(c, article.standfirst, wide)) {
		y += stand * 1.27;
		c.fillText(line.join(' '), edge, y);
	}

	// Between two fine rules, who wrote it and whose it is, and at the far end the day it came
	// out: whichever of them there are, in capitals small enough to go on the one line.
	const credits = [article.byline, article.source.name].flatMap((each) => (each ? [each.toUpperCase()] : []));
	const dated = article.date ?? '';
	const apart = 1.6; // between one credit and the next, in ems
	let credit = W * 0.0175;
	const credited = () => {
		c.letterSpacing = `${credit * 0.14}px`;
		return credits.concat(dated).reduce((sum, each, n) => {
			c.font = `${n ? 500 : 800} ${credit}px ${SERIF}`;
			return sum + c.measureText(each).width + (each && n ? credit * apart : 0);
		}, 0);
	};
	while (credited() > wide && credit > W * 0.012) credit -= 0.25;
	y += stand * 0.75;
	rule(y);
	y += credit * 2;
	let x = edge;
	credits.forEach((each, n) => {
		c.font = `${n ? 500 : 800} ${credit}px ${SERIF}`;
		c.fillText(each, x, y);
		x += c.measureText(each).width + credit * apart;
		// A stroke between one and the next.
		if (n < credits.length - 1) c.fillRect(x - credit * (apart / 2 + 0.07), y - credit * 0.8, hair, credit * 0.95);
	});
	// The last letter's spacing is not left hanging over the margin.
	c.fillText(dated, edge + wide - c.measureText(dated).width + credit * 0.14, y);
	c.letterSpacing = '0px';
	y += credit * 1.1;
	rule(y);
	y += W * 0.02;

	// The article is set first, though it is printed last, since the photograph gets whatever
	// depth the type leaves. Two columns on the one set of baselines, the same length or the first
	// a line longer. The last line is the way to the rest of it.
	const gutter = W * 0.046;
	const column = (wide - gutter) / 2;
	const foot = H - edge * 0.72;
	const small = W * 0.0205;
	const onward = 'Continue reading on DMNS’s website…';
	// Its paragraphs in order, each with the heading it comes under, if it is the first to.
	const blocks = article.sections.flatMap((section, at) =>
		section.paragraphs.map((text, i) => ({
			text,
			heading: i ? undefined : section.heading,
			// Every paragraph but the first of all and the first under a heading is indented.
			indented: i > 0 || (at > 0 && !section.heading)
		}))
	);
	type Line =
		| { words: string[]; indent: number; full: boolean; opens: boolean }
		| { heading: string }
		| { onward: true };
	// The first `count` paragraphs in type of this size.
	const set = (size: number, count: number) => {
		c.font = `${size}px ${SERIF}`;
		const all: Line[] = [];
		const space = c.measureText(' ').width;
		// How gappy it comes out: over all the lines that are spread, how far past half as wide
		// again their spaces are.
		let gappy = 0;
		for (const block of blocks.slice(0, count)) {
			if (block.heading) all.push({ heading: block.heading });
			const indent = block.indented ? size * 1.1 : 0;
			const broken = spreadLines(c, block.text, column, indent);
			broken.forEach((words, n) => {
				const full = n < broken.length - 1;
				all.push({ words, indent: n ? 0 : indent, full, opens: n === 0 });
				const spare = column - (n ? 0 : indent) - c.measureText(words.join('')).width;
				if (full) gappy += Math.max(0, spare / Math.max(1, words.length - 1) / space - 1.5) ** 2;
			});
		}
		all.push({ onward: true });
		// How many lines of the column each takes: a heading has a line of room over it, unless it is
		// the first thing in its column, and the last line has half a line over it.
		const tall = (line: Line, first: boolean) => ('heading' in line ? (first ? 1 : 2) : 'onward' in line ? 1.5 : 1);
		const run = (from: number, to: number) =>
			all.slice(from, to).reduce((sum, line, n) => sum + tall(line, n === 0), 0);
		// The second column starts wherever leaves the two nearest the same length. Not straight
		// after a heading, which is not left at the foot of a column with nothing under it, and not,
		// if it can be helped, one line into a paragraph or one line short of its end.
		let turn = 1;
		let off = Infinity;
		for (let n = 1; n < all.length; n++) {
			const [before, after] = [all[n - 1], all[n]];
			if ('heading' in before) continue;
			const orphan = 'words' in before && before.opens && before.full;
			const widow = 'words' in after && !after.opens && !after.full;
			const by = Math.abs(run(0, n) - run(n, all.length) - 0.25) + (orphan || widow ? 1.5 : 0);
			if (by < off) [turn, off] = [n, by];
		}
		return { size, count, all, tall, turn, gappy, deep: Math.max(run(0, turn), run(turn, all.length)) };
	};
	// The photograph is all of the picture, or cropped a little in height. As many whole paragraphs
	// are printed as leave it that much room in the smallest type that reads well. Then the type is
	// as much larger as still lets those on, short of too large for so narrow a column, or a shade
	// smaller if the words happen to fall better so, and the lines are let out to take up what is
	// over.
	const photo = { w: wide, h: 0 };
	const under = small * 2.8; // what the caption takes, under the photograph
	const most = (wide * 2) / 3;
	const least = wide / 1.8;
	const fits = (type: ReturnType<typeof set>) => y + least + under + type.size * 1.3 * type.deep <= foot;
	const text = { least: W * 0.0225, most: W * 0.026 };
	let type = set(text.least, blocks.length);
	while (!fits(type) && type.count > 1) type = set(text.least, type.count - 1);
	for (let larger = set(type.size + 0.25, type.count); fits(larger) && larger.size <= text.most; ) {
		type = larger;
		larger = set(type.size + 0.25, type.count);
	}
	const largest = type.size;
	for (let n = 1; n <= 4 && largest - 0.25 * n >= text.least; n++) {
		const smaller = set(largest - 0.25 * n, type.count);
		if (smaller.gappy < type.gappy - 0.5) type = smaller;
	}
	const { size, all, tall, turn, deep } = type;
	photo.h = Math.max(least, Math.min(most, foot - y - under - size * 1.36 * deep));
	const first = y + photo.h + under + size * 0.95;
	const leading = Math.max(size * 1.2, Math.min(size * 1.42, (foot - first) / (deep - 1)));

	if (clippingPhoto) {
		const from = clippingPhoto;
		const scale = Math.max(photo.w / from.naturalWidth, photo.h / from.naturalHeight);
		c.save();
		c.beginPath();
		c.rect(edge, y, photo.w, photo.h);
		c.clip();
		// Cropped, it keeps a little more of its foot than of its top, where the people are.
		c.drawImage(
			from,
			edge + (photo.w - from.naturalWidth * scale) / 2,
			y + (photo.h - from.naturalHeight * scale) * 0.4,
			from.naturalWidth * scale,
			from.naturalHeight * scale
		);
		c.restore();
		// Newsprint has no white and no black.
		c.fillStyle = 'rgb(221 220 214 / 0.18)';
		c.fillRect(edge, y, photo.w, photo.h);
	} else {
		// Without it: a hillside, as near as a few shapes go.
		c.fillStyle = '#8d8a82';
		c.fillRect(edge, y, photo.w, photo.h);
		c.fillStyle = '#5f5c56';
		c.beginPath();
		c.ellipse(edge + photo.w * 0.3, y + photo.h, photo.w * 0.45, photo.h * 0.7, 0, Math.PI, 0);
		c.fill();
	}
	c.strokeStyle = 'rgb(34 33 31 / 0.55)';
	c.lineWidth = 1;
	c.strokeRect(edge + 0.5, y + 0.5, photo.w - 1, photo.h - 1);
	y += photo.h;
	c.fillStyle = INK;
	c.font = `italic ${small}px ${SERIF}`;
	c.fillText(article.caption, edge, y + small * 1.3);

	// A fine rule down the gutter, as deep as the columns.
	c.fillRect(edge + column + gutter / 2 - hair / 2, first - size * 0.72, hair, (deep - 1) * leading + size * 0.94);

	let link: Link | undefined;
	let top = first;
	all.forEach((line, n) => {
		const at = n < turn ? 0 : 1;
		const opens = n === 0 || n === turn;
		if (n === turn) top = first;
		const x = edge + at * (column + gutter);
		const rows = tall(line, opens);
		// Each sits on the last of the lines it takes.
		const base = top + (rows - 1) * leading;
		if ('heading' in line) {
			c.font = `800 ${size * 0.78}px ${SERIF}`;
			c.letterSpacing = `${size * 0.09}px`;
			c.fillText(line.heading.toUpperCase(), x, base);
			c.letterSpacing = '0px';
		} else if ('onward' in line) {
			// Underlined, in the blue of a link, and no wider than the column.
			c.font = `italic 500 ${size}px ${SERIF}`;
			const fitted = Math.min(size, (size * column) / c.measureText(onward).width);
			c.font = `italic 500 ${fitted}px ${SERIF}`;
			const across = c.measureText(onward).width;
			c.fillStyle = '#1d3f7a';
			c.fillText(onward, x, base);
			c.fillRect(x, base + fitted * 0.16, across, Math.max(1.5, fitted * 0.065));
			c.fillStyle = INK;
			// Where it is on the sheet, with some room round it for a finger.
			const room = fitted * 0.7;
			link = {
				href: article.source.href,
				u: [(x - room) / W, (x + across + room) / W],
				v: [1 - (base + room) / H, 1 - (base - fitted - room) / H]
			};
		} else {
			// Justified: the spare room in a line is shared out between its words.
			c.font = `${size}px ${SERIF}`;
			const words = line.words;
			const taken = words.reduce((sum, word) => sum + c.measureText(word).width, 0);
			const space = c.measureText(' ').width;
			const between = line.full && words.length > 1 ? (column - line.indent - taken) / (words.length - 1) : space;
			// A line that would be too gappy has some of it put between its letters instead.
			const letters = words.join('').length;
			const track = Math.min(size * 0.035, (Math.max(0, between - space * 2) * (words.length - 1)) / letters);
			c.letterSpacing = `${track}px`;
			let wx = x + line.indent;
			for (const word of words) {
				c.fillText(word, wx, base);
				wx += c.measureText(word).width + between - (track * letters) / (words.length - 1 || 1);
			}
			c.letterSpacing = '0px';
		}
		top += rows * leading;
	});
	creased(c, W, H);
	return { map: printed(canvas), link };
}

/**
 * The other side of the clipping, which is whatever was printed on the back of the article: the
 * columns of some other page, cut through wherever the scissors went. It is the side that shows
 * while the clipping is rolled up.
 */
function clippingBack() {
	const { canvas, c, W, H } = newsprint(true);
	let seed = 7;
	const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
	// Set a little off the cut, since nobody cut along these columns.
	const COLUMNS = 3;
	const gutter = W * 0.035;
	const column = W * 0.36;
	const line = H * 0.003;
	c.fillStyle = INK;
	for (let i = -1; i < COLUMNS; i++) {
		const x = W * 0.07 + i * (column + gutter);
		let y = -line * 3 * random();
		while (y < H) {
			// Now and then a headline, or a block that was a picture.
			const kind = random();
			if (kind < 0.005) {
				c.globalAlpha = 0.3;
				c.fillRect(x, y + line * 2, column, column * 0.6);
				y += column * 0.6 + line * 5;
			} else if (kind < 0.03) {
				c.globalAlpha = 0.8;
				for (let n = 0; n < 2; n++) c.fillRect(x, y + line * 2 + n * line * 5.5, column * (0.6 + 0.4 * random()), line * 3.2);
				y += line * 14;
			} else {
				// A paragraph ends on a short line.
				const ends = random() < 0.12;
				c.globalAlpha = 0.4;
				c.fillRect(x, y, column * (ends ? 0.3 + random() * 0.5 : 1), line);
				y += line * (ends ? 4.6 : 2.9);
			}
		}
	}
	c.globalAlpha = 1;
	creased(c, W, H);
	const map = printed(canvas);
	// Seen from behind, the sheet runs the other way across.
	map.wrapS = RepeatWrapping;
	map.repeat.x = -1;
	map.offset.x = 1;
	return map;
}

/**
 * The clipping: rolled up where it is kept, which is in the skull's eye socket (see ROLL), and
 * unrolled flat to be read when it is picked up. It is a sheet with no thickness and a side
 * printed on each face.
 */
function clipping() {
	const { W, L, ALONG, ACROSS } = SHEET;
	const count = (ALONG + 1) * (ACROSS + 1);
	const positions = new Float32BufferAttribute(new Float32Array(count * 3), 3);
	const uvs: number[] = [];
	const indices: number[] = [];
	for (let j = 0; j <= ALONG; j++) {
		for (let i = 0; i <= ACROSS; i++) uvs.push(i / ACROSS, 1 - j / ALONG);
	}
	for (let j = 0; j < ALONG; j++) {
		for (let i = 0; i < ACROSS; i++) {
			const p = j * (ACROSS + 1) + i;
			const q = p + ACROSS + 1;
			indices.push(p, q, p + 1, p + 1, q, q + 1);
		}
	}
	// One grid of points, and a face of the sheet made on each side of it: the same triangles,
	// wound the other way for the back, which gives each face normals of its own, pointing out of it.
	const faces = [indices, indices.map((_, n) => indices[n - (n % 3) + [0, 2, 1][n % 3]])].map((wound) => {
		const geometry = new BufferGeometry();
		geometry.setIndex(wound);
		geometry.setAttribute('position', positions);
		geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
		return geometry;
	});

	const article = catalogue.find((entry) => entry.id === 'clipping')!.article!;
	const paper = { roughness: 1, alphaTest: 0.5 };
	const g = new Group();
	// The paper gives off a little light of its own once it is out of the skull (see `lay`): it is
	// held up nearer the camera than the light on what is held reaches, and it has to be legible.
	const { map: read, link } = clippingFront(article);
	const front = new MeshStandardMaterial({ ...paper, map: read, emissive: 0xffffff, emissiveMap: read, emissiveIntensity: 0 });
	const inner = mesh(faces[0], front);
	// Only the back casts a shadow. A shadow is cast by the faces turned away from the light, and
	// rolled up those are the far side of the roll, as they would be of anything solid. The front's
	// would be the near side, which is the very surface the light falls on.
	inner.castShadow = false;
	g.add(inner);
	const other = clippingBack();
	const back = new MeshStandardMaterial({ ...paper, map: other, emissive: 0xffffff, emissiveMap: other, emissiveIntensity: 0 });
	g.add(mesh(faces[1], back));

	// Held, it is flat and faces out of its group, its middle where the middle of the roll was,
	// which is the point the scene brings in front of the camera.
	const flat = { turned: new Quaternion(), at: new Vector3(0, REST.height / 2, 0) };
	const turned = new Quaternion();
	const at = new Vector3();
	const point = new Vector3();
	/**
	 * Put the sheet where it is `u` of the way from kept to held. It comes straight out of the
	 * socket first, the way it went in. Then it turns to face out, and while it does it starts to
	 * unroll, which is the last thing to finish.
	 */
	const lay = (u: number) => {
		const facing = smooth(0.1, 0.55, u);
		turned.slerpQuaternions(REST.turned, flat.turned, facing);
		at.lerpVectors(REST.at, flat.at, facing).addScaledVector(REST.out, REST.pull * smooth(0, 0.15, u) * (1 - facing));
		const k = smooth(0.3, 1, u);
		front.emissiveIntensity = back.emissiveIntensity = 0.4 * facing;
		for (let j = 0; j <= ALONG; j++) {
			for (let i = 0; i <= ACROSS; i++) {
				clippingPoint((L * j) / ALONG, (W * i) / ACROSS, k, point).applyQuaternion(turned).add(at);
				positions.setXYZ(j * (ACROSS + 1) + i, point.x, point.y, point.z);
			}
		}
		positions.needsUpdate = true;
		for (const geometry of faces) {
			geometry.computeVertexNormals();
			geometry.computeBoundingBox();
			geometry.computeBoundingSphere();
		}
	};
	lay(0);

	// The scene says how far it has been lifted out of the skull, and takes about half a second
	// over it, which is too quick to watch a sheet unroll in. So that is only taken as which way it is going: up, and
	// it unrolls in its own time, or back, and it is rolled up again well before it gets there.
	const UNROLL_S = 1.3;
	const ROLL_UP_S = 0.35;
	let u = 0;
	let goal = 0;
	let lifted = 0;
	const works: Works = {
		start: () => {},
		stop: () => {},
		dim: () => {},
		lifted: (share) => {
			if (share !== lifted) goal = share > lifted ? 1 : 0;
			lifted = share;
		},
		tick: (dt) => {
			if (u === goal) return false;
			u = goal > u ? Math.min(1, u + dt / UNROLL_S) : Math.max(0, u - dt / ROLL_UP_S);
			lay(u);
			// What is printed as a link is one only once the sheet is flat and can be read.
			inner.userData.links = u === 1 && link ? [link] : undefined;
			return u !== goal;
		}
	};
	g.userData.works = works;
	return g;
}

function skull() {
	// Facing forward (+z), with the frill standing up behind.
	const g = new Group();
	if (skullModel) {
		g.scale.setScalar(SKULL_LENGTH);
		g.add(mesh(skullModel.geometry, skullModel.bone));
		return g;
	}
	// The stand-in, resting on its jaw line.
	g.scale.setScalar(SKULL_SCALE);
	g.add(box(0.22, 0.2, 0.3, light, 0, 0, 0.02)); // the cranium
	g.add(box(0.14, 0.13, 0.2, light, 0, 0, 0.25)); // the snout
	const beak = horn(0.15, 0.06, light);
	beak.position.set(0, 0.07, 0.33);
	beak.rotation.x = Math.PI / 2 + 0.35; // hooked forward and down
	g.add(beak);
	// The frill: a broad disc on edge, tipped back.
	const frill = mesh(new CylinderGeometry(0.25, 0.25, 0.035, 40), light, 0, 0.28, -0.14);
	frill.scale.x = 1.12;
	frill.rotation.x = Math.PI / 2 - 0.45;
	g.add(frill);
	// The two long brow horns, and the short one on the nose.
	for (const side of [-1, 1]) {
		const brow = horn(0.36, 0.034, light);
		brow.position.set(side * 0.08, 0.18, 0.1);
		brow.rotation.set(0.95, 0, -side * 0.16);
		g.add(brow);
	}
	const nose = horn(0.1, 0.03, light);
	nose.position.set(0, 0.12, 0.3);
	nose.rotation.x = 0.35;
	g.add(nose);
	return g;
}

/**
 * Lettering to go down a book's spine: a strip `length` by `width` (world units) with `text` set
 * along it, on a clear ground. Turned so that it reads from the top of the book to the bottom.
 */
function spineTitle(text: string, length: number, width: number, ink: string) {
	const PX = 1600; // per world unit
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(length * PX);
	canvas.height = Math.round(width * PX);
	const c = canvas.getContext('2d')!;
	const size = canvas.height * 0.5;
	const font = (px: number) => `600 ${px}px system-ui, sans-serif`;
	c.font = font(size);
	// Shrunk, if need be, to fit the spine's length.
	const room = canvas.width * 0.88;
	c.font = font(size * Math.min(1, room / c.measureText(text).width));
	c.fillStyle = ink;
	c.textAlign = 'center';
	c.textBaseline = 'middle';
	c.fillText(text, canvas.width / 2, canvas.height / 2);
	const map = new CanvasTexture(canvas);
	map.colorSpace = SRGBColorSpace;
	map.anisotropy = 8;
	const m = new Mesh(
		new PlaneGeometry(length, width),
		new MeshStandardMaterial({ map, transparent: true, roughness: 0.9 })
	);
	m.rotation.z = -Math.PI / 2;
	return m;
}

/**
 * A book standing up with its spine to the front and its title down the spine. The front cover
 * is its right-hand face.
 */
function book(thick: number, tall: number, deep: number, cover: MeshStandardMaterial, title: string) {
	return () => {
		const g = new Group();
		g.add(box(thick, tall, deep, cover));
		// The pages, set in a little from the covers on three sides.
		g.add(box(thick * 0.72, tall - 0.014, deep - 0.012, page, 0, 0.007, -0.008));
		// Light lettering on a dark cover, dark on a light one.
		const hsl = cover.color.getHSL({ h: 0, s: 0, l: 0 });
		const lettering = spineTitle(title, tall, thick, hsl.l > 0.35 ? '#1b1b1d' : '#e6e1d4');
		lettering.position.set(0, tall / 2, deep / 2 + 0.001);
		g.add(lettering);
		return g;
	};
}

// The skull stands on its teeth at the left end, side on, its beak just short of the wall and its
// frill standing up at the other end like a shield. The books stand in a row to the right of it
// and lean left into the back of the frill. The first is the shortest, which lets it tuck in under
// the frill's rim, and each of the others rests on the one before. Leaning at the same angle,
// their bottom-left edges are a thickness apart measured along the shelf, which is a little more
// than the thickness itself.
const SKULL_X = -0.18;
const SKULL_BACK = 0.5; // how far back its middle is, as a share of the shelf's depth
const SKULL_YAW = -Math.PI / 2;
const SKULL_LENGTH = 0.7; // the scanned skull, from beak to frill
const SKULL_SCALE = 0.8; // its stand-in
const BOOK_LEAN = 0.1;
const BOOKS_FROM = SKULL_X + 0.3377; // where the first book's bottom-left edge sits
const volumes: [thick: number, tall: number, deep: number, cover: MeshStandardMaterial][] = [
	[0.07, 0.46, 0.34, dark],
	[0.05, 0.4, 0.3, mid],
	[0.085, 0.44, 0.34, light],
	[0.055, 0.37, 0.28, accent],
	[0.065, 0.42, 0.32, mid]
];
// The order they stand in, from the skull outward.
const SHELVED = [3, 1, 4, 2, 0];
const TUCKED = SHELVED[0];

let edge = BOOKS_FROM;
const books: Placement[] = SHELVED.map((i) => {
	const [thick, tall, deep, cover] = volumes[i];
	const id = `book-${i + 1}`;
	// The title on the spine is the book's name in the catalogue.
	const title = catalogue.find((entry) => entry.id === id)!.label;
	const x = edge + (thick / 2) * Math.cos(BOOK_LEAN);
	edge += thick / Math.cos(BOOK_LEAN);
	return {
		id,
		shelf: 2,
		x,
		// Centred on the frill from front to back, whatever the book's depth.
		back: 0.5,
		lean: BOOK_LEAN,
		// The one tucked in under the frill stays there: it could not come out past the skull.
		fixed: i === TUCKED,
		// Front cover to the viewer, turned enough to show the spine as well.
		held: { pitch: 0.12, yaw: -Math.PI / 2 + 0.45 },
		build: book(thick, tall, deep, cover, title)
	};
});

// The clipping's sheet, in the room's units: as wide as the roll is long, and as long as it takes
// to wind that many turns from the core out to the roll's radius, which leaves `gap` between one
// turn and the next. It is this many px across when it is printed, and is drawn as a grid, ALONG
// by ACROSS, fine enough along it to go round the core smoothly.
const SHEET = {
	W: (ROLL.inside + ROLL.outside) * SKULL_LENGTH,
	L: Math.PI * (ROLL.r + ROLL.core) * ROLL.turns * SKULL_LENGTH,
	core: ROLL.core * SKULL_LENGTH,
	gap: ((ROLL.r - ROLL.core) / ROLL.turns) * SKULL_LENGTH,
	inside: ROLL.inside * SKULL_LENGTH,
	outside: ROLL.outside * SKULL_LENGTH,
	PX: 1024,
	ALONG: 260,
	ACROSS: 10
};

// How the rolled-up clipping lies in the socket, worked out once: it is needed to place it on the
// shelf as well as to build it. The sheet's own frame (see clippingPoint) is `turned` and put
// `at` this, in a frame that stands as the room does with its origin under the middle of the
// roll, at its lowest point, which is what the scene wants of an object (`base` is where that is
// from the skull's own origin on the shelf). `out` is the way the roll points, which is the way
// it is pulled out of the socket, by `pull`. `height` is how tall the roll stands.
const REST = (() => {
	const { W, L, ALONG, ACROSS, core, gap, inside } = SHEET;
	const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), SKULL_YAW);
	const turned = yaw
		.clone()
		.multiply(new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), ROLL.toward))
		.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), ROLL.spin));
	// The point on the roll's axis that is level with the socket goes in the middle of the socket.
	const axis = new Vector3(inside - W / 2, L / 2, Math.sqrt(core * core + (L * gap) / Math.PI));
	const at = ROLL.at.clone().multiplyScalar(SKULL_LENGTH).applyQuaternion(yaw).sub(axis.applyQuaternion(turned));
	const low = new Vector3(Infinity, Infinity, Infinity);
	const high = low.clone().negate();
	const point = new Vector3();
	for (let j = 0; j <= ALONG; j++) {
		for (let i = 0; i <= ACROSS; i++) {
			clippingPoint((L * j) / ALONG, (W * i) / ACROSS, 0, point).applyQuaternion(turned).add(at);
			low.min(point);
			high.max(point);
		}
	}
	const base = new Vector3((low.x + high.x) / 2, low.y, (low.z + high.z) / 2);
	return {
		turned,
		at: at.sub(base),
		base,
		out: ROLL.toward.clone().applyQuaternion(yaw),
		pull: inside + 0.03,
		height: high.y - low.y
	};
})();

// The photograph that is printed on the clipping, if it has been saved in the assets as
// dig-site: without it, a grey block stands in for it.
const digSite = Object.values(
	import.meta.glob<string>('../../assets/dig-site.{jpg,jpeg,png,webp}', {
		eager: true,
		query: '?url',
		import: 'default'
	})
)[0];
let clippingPhoto: HTMLImageElement | undefined;

/**
 * Fetch what the clipping is printed with: its typeface and its photograph. Whatever cannot be had
 * is done without.
 */
export async function loadClipping() {
	// Every weight of the clipping's face is in the one file, and its italic in another.
	const news = [
		new FontFace(NEWS_FACE, `url(${fraunces})`, { weight: '100 900' }),
		new FontFace(NEWS_FACE, `url(${frauncesItalic})`, { weight: '100 900', style: 'italic' })
	];
	const photo = new Image();
	if (digSite) photo.src = digSite;
	await Promise.allSettled([
		...news.map((each) => each.load().then((loaded) => document.fonts.add(loaded))),
		digSite ? photo.decode().then(() => (clippingPhoto = photo)) : undefined
	]);
}

export const skullPlacements: Placement[] = [
	{
		id: 'skull',
		shelf: 2,
		x: SKULL_X,
		back: SKULL_BACK,
		yaw: SKULL_YAW,
		// Face to the viewer and turned half left, to show a horn, an eye and the frill behind them.
		held: { pitch: 0.1, yaw: -0.6 },
		build: skull
	},
	{
		// In the skull's eye socket, wherever on the shelf that puts it (see REST).
		id: 'clipping',
		shelf: 2,
		x: SKULL_X + REST.base.x,
		back: SKULL_BACK - REST.base.z / RACK_DEPTH,
		up: REST.base.y,
		rides: 'skull',
		page: { w: SHEET.W, h: SHEET.L },
		build: clipping
	},
	...books
];
