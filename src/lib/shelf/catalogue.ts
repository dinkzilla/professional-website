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
		id: 'turntable',
		label: 'turntable',
		blurb: 'Plays the album. Drag the record to scratch it.'
	},
	{
		id: 'album',
		label: 'album',
		blurb: 'The sleeve flips over to show the notes on the back.'
	},
	{
		id: 'headphones',
		label: 'headphones',
		blurb: 'Set dressing for the turntable, or possibly the volume control.'
	},
	{
		id: 'mothersheet',
		label: 'mothersheet',
		blurb: 'The lid lifts and the instruction manual slides out, with a link to the character sheet.'
	},
	{
		id: 'work',
		label: 'work',
		blurb: 'The way back to the work side of the site.'
	},
	{
		id: 'kickball',
		label: 'kickball phone',
		blurb: 'The batting-order texter. The description shows on the screen and the keys scroll it.'
	},
	{
		id: 'video-module',
		label: 'video module',
		blurb: 'The knobs work, and the monitor shows what the module is putting out.'
	},
	{
		id: 'monitor',
		label: 'monitor',
		blurb: 'Shows the video module’s output.'
	},
	{
		id: 'book',
		label: 'book',
		blurb: 'In progress. The bookmark shows how far along it is.'
	}
];
