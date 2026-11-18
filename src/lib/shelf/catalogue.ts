// What is on the shelf: the name and words for each object. Kept apart from the objects' shapes
// (items.ts) so that a page can show these without loading three.js.

/** Something to read: part of an article from somewhere else, which the whole of is linked to. */
export interface Article {
	headline: string;
	standfirst: string;
	/** Under its photograph, where it is printed with one. */
	caption: string;
	sections: { heading?: string; paragraphs: string[] }[];
	source: { name: string; href: string };
}

export interface Entry {
	id: string;
	label: string;
	/** Placeholder copy for the panel shown when the object is picked up. */
	blurb: string;
	/** What the panel has to read in place of that, for an object that is something to read. */
	article?: Article;
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
	{
		// The opening of the museum's own account of a skull like this one being found: quoted, not
		// the whole of it, which is theirs and is linked to. It is printed on the clipping as well
		// (see items.ts).
		id: 'clipping',
		label: 'clipping',
		blurb: 'Rolled up and pushed into the eye socket.',
		article: {
			headline: 'Triceratops Discovery',
			standfirst: 'Remarkably complete Triceratops skull, lower jaws, and neck',
			caption: 'Triceratops dig site bustling with activity.',
			sections: [
				{
					paragraphs: [
						'A team of paleontologists and student interns from the Denver Museum of Nature & Science discovered a remarkably complete and visually stunning Triceratops skull, lower jaws, and neck. Uncovered during the Museum’s annual summer fieldwork in the Hell Creek Formation near Marmarth, North Dakota, the around 67-million-year-old Triceratops skeleton is one of the heaviest fossils the Museum has ever collected — second only to the Museum’s famed Stegosaurus in the "Prehistoric Journey" preparation lab.',
						'Weighing in at over 5.4 tons, the paleontologists have brought the massive field jacket containing the skull, lower jaw, articulated neck and portions of the spine and ribcage embedded in rock and dirt back to the Museum, where it is currently being prepared in public view in the “Discovering Teen Rex” exhibition.'
					]
				},
				{
					heading: 'The Find',
					paragraphs: [
						'The fossil was initially spotted in the summer of 2024 by Casey Thater, a CU Boulder graduate student and summer volunteer with the Museum, who noticed part of the Triceratops shield poking out of a hillside. What began as a routine dig quickly revealed a pristine skull that extended down through the neck and ribcage. The fossil’s extraordinary preservation led the team to pursue full excavation the following summer under permit from the U.S.D.A Forest Service, which manages the public lands and resources where the find was made and collaborated closely with the Museum in the fossil’s excavation in July, 2025.',
						'More than 50 interns and students from 21 universities across four continents contributed to the excavation, adding muscle and momentum to the massive undertaking.'
					]
				}
			],
			source: {
				name: 'Denver Museum of Nature & Science',
				href: 'https://www.dmns.org/science/research/triceratops-discovery/'
			}
		}
	},
	...['one', 'two', 'three', 'four', 'five'].map((n, i) => ({
		id: `book-${i + 1}`,
		label: `book ${n}`,
		blurb: 'Placeholder: what this book is about.'
	})),
	{
		id: 'mothersheet',
		label: 'mothersheet',
		blurb: 'Placeholder: what this game is.'
	},
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
