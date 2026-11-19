// What is on the shelf: the name and words for each object. Kept apart from the objects' shapes
// (items.ts) so that a page can show these without loading three.js.

/** Something to read: part of an article from somewhere else, which the whole of is linked to. */
export interface Article {
	headline: string;
	standfirst: string;
	/** Who wrote it, as it is credited, and the day it was published, as it is given. */
	byline?: string;
	date?: string;
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
			headline: 'Museum Scientists Discover a Complete Triceratops Skull',
			standfirst:
				'How a Team of Paleontologists, Fossil Preparators and Interns Came Together to Excavate One of the Largest Fossils the Museum Has Ever Collected',
			byline: 'By Jordan Cooper',
			date: '10/6/2025',
			caption: 'Triceratops dig site bustling with activity.',
			// The opening of it, as far as is kept here. A clipping prints as much of this as it has
			// paper for, and stops at the end of a paragraph.
			sections: [
				{
					paragraphs: [
						'To a team of Denver Museum of Nature & Science paleontologists, fossil preparators and interns, the hillside of a desolate stretch of the Hell Creek badlands of North Dakota in the dead of summer felt like paradise. Awaiting them was a once-in-a-lifetime opportunity to excavate and collect a complete Triceratops skull, including the lower jaw, neck and a variety of vertebrae and rib bones.',
						'Pieces of Triceratops skulls and shields are common in the area – scattered like bits of hard candy across the mottled terrain – however, finding a complete skull with lower jaws and an articulated neck is vanishingly rare. “You just don\'t have that many 100 percent complete skulls of any dinosaur, and this one is literally 100 percent complete,” said Dr. Tyler Lyson, senior curator of vertebrate paleontology, who led the expedition.',
						'In a stroke of good fortune, this incredible find was located on public lands managed by the U.S.D.A. Forest Service, which agreed to partner with the Museum to collect the fossil.',
						'Prying this year’s discovery from the earth and bringing it home would require not only brute force but also creative problem solving, an assortment of heavy-duty machinery, several modes of transportation and most importantly, teamwork.',
						'Thankfully, over 50 interns, students and collaborators representing 21 colleges and four continents joined the dig this year. Interns provide the raw power, energy and grit as well as critical thinking skills that help bring large-scale excavation projects at the Museum to fruition. In fact, it was an intern who made the initial discovery during the 2024 field season.',
						'“Interns and students are the engine that makes our field program and lab program tick. Every single step is powered by young people psyched about fossils,” Museum fossil preparator Salvador Bastien said.',
						'The dig site was dominated by an enthusiasm that only a team of young, eager fossil hunters can muster – a dozen or so interns at a time would claw the earth with shovels, pickaxes and rock hammers, dragging mounds of dirt piled atop a tarp unceremoniously over the edge and pausing periodically to do fine brush work or marvel at the latest discovery. They would pass the time by singing acapella, doing celebrity impressions and challenging each other to consume as many energy drinks as they could stomach.',
						'The experience was not only memorable for the interns but could open doors into careers in paleontology and the sciences that never would have existed otherwise. “Being able to do field work as well as lab work and learn from amazing people at the Museum has really changed my focus on what I think I want to do and opened up more opportunities and possibilities of things I could do in future lives,” said intern Marisa Luft.',
						'The excavation team, which was largely composed of interns, was charged with digging a Triceratops-sized hole – larger than an African elephant – out of the impossibly hard-packed sand that provides an ideal medium for preservation. Wielding a 70-pound jackhammer called “The Brute,” the team spent two days removing the overburden before beginning to use finer tools.'
					]
				}
			],
			source: {
				name: 'Denver Museum of Nature & Science',
				href: 'https://www.dmns.org/catalyst/museum-stories/museum-scientists-discover-a-complete-triceratops-skull/'
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
