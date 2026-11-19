// Stands in for mpv, the player the video module's program drives, and for the HDMI output it
// plays to. It takes the commands the program sends: load a file in place of what is playing or
// after it, loop the file that is playing or do not, and say which file it is on.
//
// The files play in video elements that are never put on the page. Each new frame of the one on
// screen is copied to a canvas, which is the picture sent down the cable: the scene uses it as a
// texture on the tv (see tv in #lib/shelf/objects/video.ts).
//
// A browser fetches a file where mpv has it to hand, so a file loaded in place of another is
// swapped in when its first frame is ready, and until then the picture stays as it was.

/** A video file: the name the module shows for it, and where it is. */
export interface Clip {
	name: string;
	url: string;
}

interface Player {
	clip: Clip;
	video: HTMLVideoElement;
}

// The picture sent to the tv, in pixels: the size the clips are made at.
const WIDTH = 640;
const HEIGHT = 360;

export type Mpv = ReturnType<typeof createMpv>;

/** A player with nothing loaded. `sent` is called whenever the picture it sends has changed. */
export function createMpv(sent: () => void) {
	const picture = document.createElement('canvas');
	picture.width = WIDTH;
	picture.height = HEIGHT;
	const c = picture.getContext('2d', { alpha: false })!;
	c.fillRect(0, 0, WIDTH, HEIGHT);

	let playing: Player | undefined; // the file on screen
	let incoming: Player | undefined; // one that takes its place as soon as it has a frame to show
	let playlist: Player[] = []; // those that follow it
	let looping = true;
	let watched = false; // whether the picture is being shown anywhere
	let refused = false; // the browser would not start a video unasked
	let moved: (() => void) | undefined;

	function open(clip: Clip): Player {
		const video = document.createElement('video');
		// Silent, and played where it is and not full screen: what a browser wants of a video
		// before it will start one unasked.
		video.muted = true;
		video.playsInline = true;
		video.preload = 'auto';
		video.src = clip.url;
		return { clip, video };
	}

	function close(player: Player | undefined) {
		if (!player) return;
		player.video.pause();
		player.video.removeAttribute('src');
		player.video.load();
	}

	function start(video: HTMLVideoElement) {
		video.play().then(
			() => (refused = false),
			(error: DOMException) => {
				// Refused outright, as opposed to cut short by a pause or a change of file.
				if (error.name === 'NotAllowedError') refused = true;
			}
		);
	}

	// A browser that would not start a video unasked will once the visitor has done something on
	// the page, whatever it is.
	const retry = () => {
		if (!refused || !watched) return;
		for (const player of [incoming, playing]) if (player) start(player.video);
	};
	for (const type of ['pointerdown', 'pointerup', 'keydown', 'touchend']) {
		window.addEventListener(type, retry, { capture: true, passive: true });
	}

	/** Send a frame of this video, or with none, black. */
	function paint(video?: HTMLVideoElement) {
		c.fillStyle = '#000';
		c.fillRect(0, 0, WIDTH, HEIGHT);
		if (video?.videoWidth) {
			// All of the frame, as large as it will go, with black wherever it does not reach.
			const scale = Math.min(WIDTH / video.videoWidth, HEIGHT / video.videoHeight);
			const w = video.videoWidth * scale;
			const h = video.videoHeight * scale;
			c.drawImage(video, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
		}
		sent();
	}

	/** Send each new frame of a file for as long as it is the one on screen. */
	function follow(player: Player) {
		const { video } = player;
		// A few times a second come what may, in case a browser that can say when there is a new
		// frame does not, for a video that is not on the page.
		video.addEventListener('timeupdate', () => player === playing && paint(video));
		if (typeof video.requestVideoFrameCallback === 'function') {
			const frame = () => {
				if (player !== playing) return;
				paint(video);
				video.requestVideoFrameCallback(frame);
			};
			video.requestVideoFrameCallback(frame);
		} else {
			// A browser that cannot say when there is a new frame is asked every time it draws.
			const frame = () => {
				if (player !== playing) return;
				if (!video.paused) paint(video);
				requestAnimationFrame(frame);
			};
			requestAnimationFrame(frame);
		}
	}

	/** Put a file on screen in place of whatever is there. */
	function show(player: Player) {
		const { video } = player;
		close(playing);
		playing = player;
		video.loop = looping;
		video.addEventListener('ended', () => player === playing && advance());
		video.addEventListener('error', () => player === playing && advance());
		if (watched) start(video);
		if (video.readyState >= video.HAVE_CURRENT_DATA) paint(video);
		else video.addEventListener('loadeddata', () => player === playing && paint(video), { once: true });
		follow(player);
		moved?.();
	}

	/** The file on screen has ended, or cannot be played: go on to the next, or to nothing. */
	function advance() {
		const next = playlist.shift();
		if (next) return show(next);
		close(playing);
		playing = undefined;
		paint();
		moved?.();
	}

	return {
		/** What is sent to the tv. */
		picture,
		/** Play a file: now, in place of what is playing and all that was to follow it, or after them. */
		loadfile(clip: Clip, how: 'replace' | 'append') {
			if (how === 'append') {
				playlist.push(open(clip));
				return;
			}
			playlist.forEach(close);
			playlist = [];
			close(incoming);
			const player = (incoming = open(clip));
			const arrive = (playable: boolean) => {
				if (incoming !== player) return;
				incoming = undefined;
				if (playable) return show(player);
				close(player);
				advance();
			};
			player.video.addEventListener('loadeddata', () => arrive(true), { once: true });
			player.video.addEventListener('error', () => arrive(false), { once: true });
			// Started at once, unseen: some browsers fetch nothing of a video until it is played.
			if (watched) start(player.video);
		},
		/** Whether the file that is playing starts again when it ends, or gives way to the next. */
		loop(on: boolean) {
			looping = on;
			if (playing) playing.video.loop = on;
		},
		/** The file it is on: the one playing, or the one about to take its place. */
		get file() {
			return (incoming ?? playing)?.clip;
		},
		/** Have this called whenever it goes on to another file, or to none. */
		onfile(callback: (() => void) | undefined) {
			moved = callback;
		},
		/** Play for as long as the picture is being shown somewhere, and hold still when it is not. */
		run(on: boolean) {
			watched = on;
			for (const player of [incoming, playing]) {
				if (!player) continue;
				if (on) start(player.video);
				else player.video.pause();
			}
		}
	};
}
