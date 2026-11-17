// Stands in for the video module's display, and for the library its program draws on it with.
// The display is an SSD1306 OLED: 128 pixels by 32, each of them lit or not. Text is set in the
// plain 5 by 7 font such displays usually carry, a character every six pixels as in the
// library's own, so a line holds 21 characters and anything longer runs off the right-hand edge.
//
// What is drawn is kept on a canvas, a square of canvas pixels to each of the display's, which the
// scene uses as a texture (see videoModule in #lib/shelf/items.ts).

export const WIDTH = 128;
export const HEIGHT = 32;
const PX = 4; // canvas pixels to each of the display's, each way
const ADVANCE = 6; // from one character to the next: its five columns and a gap
// The library's font has two blank rows above its capitals, which is why the module's program
// draws from two rows above the top of the display. This font has none, so its text is set that
// much lower than asked, and lands where the program means it to.
const LEAD = 2;
const GLOW = '#5fc0ff'; // the blue such a display's pixels light up in

// The characters from space to tilde. Each is five columns from left to right, a byte to a
// column, whose bits are that column's eight rows from the top down: the top row is 01 and the
// bottom, which only descenders reach, is 80.
const FONT = (
	'0000000000 00005F0000 0007000700 147F147F14 242A7F2A12 2313086462 3649562050 0008070300 ' + //  !"#$%&'
	'001C224100 0041221C00 2A1C7F1C2A 08083E0808 0080703000 0808080808 0000606000 2010080402 ' + // ()*+,-./
	'3E5149453E 00427F4000 7249494946 2141494D33 1814127F10 2745454539 3C4A494931 4121110907 ' + // 01234567
	'3649494936 464949291E 0000140000 0040340000 0008142241 1414141414 0041221408 0201590906 ' + // 89:;<=>?
	'3E415D594E 7C1211127C 7F49494936 3E41414122 7F4141413E 7F49494941 7F09090901 3E41415173 ' + // @ABCDEFG
	'7F0808087F 00417F4100 2040413F01 7F08142241 7F40404040 7F021C027F 7F0408107F 3E4141413E ' + // HIJKLMNO
	'7F09090906 3E4151215E 7F09192946 2649494932 03017F0103 3F4040403F 1F2040201F 3F4038403F ' + // PQRSTUVW
	'6314081463 0304780403 6159494D43 007F414141 0204081020 004141417F 0402010204 4040404040 ' + // XYZ[\]^_
	'0003070800 2054547840 7F28444438 3844444428 384444287F 3854545418 00087E0902 18A4A49C78 ' + // `abcdefg
	'7F08040478 00447D4000 2040403D00 7F10284400 00417F4000 7C04780478 7C08040478 3844444438 ' + // hijklmno
	'FC18242418 18242418FC 7C08040408 4854545424 04043F4424 3C4040207C 1C2040201C 3C4030403C ' + // pqrstuvw
	'4428102844 4C9090907C 4464544C44 0008364100 0000770000 0041360800 0201020402' // xyz{|}~
).split(' ');
const UNKNOWN = FONT['?'.charCodeAt(0) - 32];

export type Oled = ReturnType<typeof createOled>;

/** A display, blank. `shown` is called whenever what is on it has changed. */
export function createOled(shown: () => void) {
	const canvas = document.createElement('canvas');
	canvas.width = WIDTH * PX;
	canvas.height = HEIGHT * PX;
	const c = canvas.getContext('2d')!;
	// The picture being drawn, a byte to a pixel. None of it is on the display until it is shown.
	const lit = new Uint8Array(WIDTH * HEIGHT);

	function paint() {
		c.fillStyle = '#000';
		c.fillRect(0, 0, canvas.width, canvas.height);
		c.fillStyle = GLOW;
		for (let y = 0; y < HEIGHT; y++) {
			for (let x = 0; x < WIDTH; x++) {
				if (lit[y * WIDTH + x]) c.fillRect(x * PX, y * PX, PX, PX);
			}
		}
	}
	paint();

	return {
		canvas,
		/** Start a new picture, with nothing lit. */
		clear() {
			lit.fill(0);
		},
		/** Set a line of text in the picture, the top left of its first character's cell at (x, y). */
		text(x: number, y: number, line: string) {
			for (let i = 0; i < line.length; i++) {
				const columns = FONT[line.charCodeAt(i) - 32] ?? UNKNOWN;
				for (let column = 0; column < 5; column++) {
					const rows = parseInt(columns.slice(column * 2, column * 2 + 2), 16);
					const px = x + i * ADVANCE + column;
					if (px < 0 || px >= WIDTH) continue;
					for (let row = 0; row < 8; row++) {
						const py = y + LEAD + row;
						if (rows & (1 << row) && py >= 0 && py < HEIGHT) lit[py * WIDTH + px] = 1;
					}
				}
			}
		},
		/** Put the picture on the display. */
		show() {
			paint();
			shown();
		}
	};
}
