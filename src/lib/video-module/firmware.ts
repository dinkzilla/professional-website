// The video module's program: a port of the Python that runs on the real one's Raspberry Pi,
// function for function. A loop plays on the tv, over and over. The display lists the triggers;
// the knob moves up and down the list, and pressing it plays the one marked, after which another
// loop takes over. The switch says whether that loop, and the one played first, is picked at
// random (high) or is the next in order (low).
//
// Where the original sends commands to mpv and draws on its OLED, this does the same to their
// stand-ins (mpv.ts, oled.ts). Where the original sleeps, or waits for a trigger to end, it is
// not reading its controls, and this is deaf to them for just as long.

import type { Clip, Mpv } from './mpv.ts';
import type { Oled } from './oled.ts';

/**
 * The files in a folder, in the order of their names. A page cannot list a folder as it runs, so
 * this is done when the site is built: whatever is in the folder then is what there is. A file's
 * name is shown without the ending a web server needs it to have.
 */
function found(files: Record<string, string>): Clip[] {
	return Object.entries(files)
		.map(([path, url]) => ({ name: path.slice(path.lastIndexOf('/') + 1).replace(/\.mp4$/, ''), url }))
		.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

const loopFiles = found(
	import.meta.glob<string>('../assets/loops/*.mp4', { eager: true, query: '?url', import: 'default' })
);
const triggerFiles = found(
	import.meta.glob<string>('../assets/triggers/*.mp4', { eager: true, query: '?url', import: 'default' })
);
// The first thing in the list is not a file: it stands for any one of the triggers.
triggerFiles.unshift({ name: '[RANDOM]', url: '' });

const sleep = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

/** A whole number from `from` up to but not including `to`, or from none up to `from`. */
function randrange(from: number, to?: number) {
	const [low, high] = to === undefined ? [0, from] : [from, to];
	return low + Math.floor(Math.random() * (high - low));
}

/**
 * The program, not yet started. `switchHigh` reads the toggle switch; the button and the knob
 * are reported to it as they are worked.
 */
export function createFirmware(mpv: Mpv, oled: Oled, switchHigh: () => boolean) {
	let loopIndex = 0;
	let triggerIndex = 0;
	let triggerPlaying = false;
	// Asleep or busy, and not reading the controls.
	let deaf = true;
	// While a trigger plays, after its first few seconds: what a press of the button does.
	let cancel: (() => void) | undefined;

	async function playLoop(index: number) {
		mpv.loadfile(loopFiles[index], 'replace');
		mpv.loop(true);
		// Debounce and allow video to start.
		await sleep(2);
	}

	async function playTrigger(index: number) {
		deaf = true;
		triggerIndex = index === 0 ? randrange(1, triggerFiles.length) : index;

		mpv.loadfile(triggerFiles[triggerIndex], 'replace');
		mpv.loop(false);

		// Add next loop to prevent interruption when video ends.
		const nextLoopIndex = switchHigh() ? randrange(loopFiles.length) : (loopIndex + 1) % loopFiles.length;
		mpv.loadfile(loopFiles[nextLoopIndex], 'append');

		// Debounce and let video load.
		triggerPlaying = true;
		display();
		await sleep(3);

		// Until the player has gone on to the loop, the button cancels.
		const cancelled = await new Promise<boolean>((resolve) => {
			const check = () => mpv.file === loopFiles[nextLoopIndex] && resolve(false);
			mpv.onfile(check);
			cancel = () => resolve(true);
			check();
		});
		mpv.onfile(undefined);
		cancel = undefined;
		triggerPlaying = false;

		if (cancelled) {
			display();
			await playLoop(loopIndex);
			deaf = false;
			return;
		}

		// After the triggered video finishes, start looping again.
		mpv.loop(true);

		// Increment indexes. (With the switch high this draws a second loop at random, not the one
		// just queued: it is the loop a later cancel goes back to. The original does the same.)
		triggerIndex = (triggerIndex + 1) % triggerFiles.length;
		loopIndex = switchHigh() ? randrange(loopFiles.length) : (loopIndex + 1) % loopFiles.length;
		display();
		deaf = false;
	}

	/** What the display shows: the original redraws it ten times a second, this when it changes. */
	function display() {
		const top = -2;
		const name = (index: number) => triggerFiles[index].name;
		oled.clear();
		if (triggerPlaying) {
			oled.text(0, top + 4, 'Now Playing:');
			oled.text(0, top + 13, '  ' + name(triggerIndex));
			oled.text(0, top + 22, '>>>  Cancel');
		} else if (triggerIndex === 0) {
			oled.text(0, top + 0, '>>>  ' + name(triggerIndex));
			if (triggerIndex + 1 < triggerFiles.length) oled.text(0, top + 9, '  ' + name(triggerIndex + 1));
			if (triggerIndex + 2 < triggerFiles.length) oled.text(0, top + 18, '  ' + name(triggerIndex + 2));
		} else {
			oled.text(0, top + 0, '  ' + name(triggerIndex - 1));
			oled.text(0, top + 9, '>>>  ' + name(triggerIndex));
			if (triggerIndex + 1 < triggerFiles.length) oled.text(0, top + 18, '  ' + name(triggerIndex + 1));
		}
		oled.show();
	}

	return {
		/** Switch it on. */
		main() {
			// No loop videos found.
			if (!loopFiles.length) return;
			if (switchHigh()) loopIndex = randrange(loopFiles.length);
			mpv.loadfile(loopFiles[loopIndex], 'replace');
			mpv.loop(true);
			display();
			deaf = false;
		},
		/** The button was pressed: the knob, pushed in. */
		button() {
			if (cancel) cancel();
			// The original falls over if asked to pick at random from no triggers at all.
			else if (!deaf && triggerFiles.length > 1) playTrigger(triggerIndex);
		},
		/** The knob was turned one click: clockwise is down the list, and the list goes round. */
		rotary(direction: 'up' | 'down') {
			if (deaf) return;
			const step = direction === 'down' ? 1 : -1;
			triggerIndex = (triggerIndex + step + triggerFiles.length) % triggerFiles.length;
			display();
		}
	};
}
