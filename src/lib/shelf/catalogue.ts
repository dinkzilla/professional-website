// What is on the shelf: the name and words for each object. Kept apart from the objects' shapes
// (items.ts) so that a page can show these without loading three.js.

export interface Entry {
	id: string;
	label: string;
	/** Placeholder copy for the panel shown when the object is picked up. */
	blurb: string;
}

export const catalogue: Entry[] = [
	{
		id: 'tv',
		label: 'tv',
		blurb: 'Shows what the video module is putting out.'
	},
	{
		id: 'cat',
		label: 'cat',
		blurb: 'Asleep on the warm spot.'
	},
	{
		id: 'video-module',
		label: 'video module',
		blurb: 'The knob and the switch work, and the tv shows the result.'
	},
	{
		id: 'skull',
		label: 'triceratops',
		blurb: 'Holds the books up.'
	},
	...['one', 'two', 'three', 'four', 'five'].map((n, i) => ({
		id: `book-${i + 1}`,
		label: `book ${n}`,
		blurb: 'Placeholder: what this book is about.'
	})),
	...['one', 'two', 'three', 'four', 'five'].map((n, i) => ({
		id: `flier-${i + 1}`,
		label: `flier ${n}`,
		blurb: 'Placeholder: which show this was.'
	})),
	{
		// The way back to the work side: a tap on it goes there (see routes/personal). It is never
		// picked up, so its blurb is not shown.
		id: 'tie',
		label: 'tie',
		blurb: 'Still tied, for getting back into quickly.'
	},
	{
		id: 'cassette',
		label: 'cassette player',
		blurb: 'Plays the tape. The transport buttons work.'
	}
];
