// Puts fliers on the board in the personal side's room. Run with five pictures, in the order
// they are to be pinned up (top row left to right, then the bottom row):
//
//   npm run fliers -- one.jpg two.png three.webp four.jpg five.jpg
//
// The board shows whatever pictures are in src/lib/assets/fliers, in the order of their names
// (see flierArt in src/lib/shelf/items.ts). This replaces all of them: each picture given is
// made no larger than a flier needs, saved there as 1.webp to 5.webp, and what was there before
// is removed. Nothing is changed unless every picture can be read.
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const COUNT = 5;
// The longest side of a saved picture: a flier taken down fills the window, and is to be read,
// so this is as much as a large window shows of it.
const LONGEST = 1600;
// A picture smaller than this on its longer side is too small to read once it fills a window.
const SMALLEST = 900;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fliersDir = path.join(root, 'src/lib/assets/fliers');

const given = process.argv.slice(2);
if (given.length !== COUNT) {
	console.error(`The board takes ${COUNT} fliers, and ${given.length} were given.`);
	process.exit(1);
}

const made = [];
for (const file of given) {
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
