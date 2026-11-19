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

/**
 * A picture in the manual: one of the screenshots saved in the assets' manual folder, by its
 * number there, or a part of one (`crop`: left, top, width and height, as shares of the picture).
 */
export interface Figure {
	art: number;
	crop?: [x: number, y: number, w: number, h: number];
	caption: string;
}

/** A thing with a name, and what is said about it. */
export interface Point {
	label: string;
	text: string;
}

/** One thing on a page of the manual. They are printed down the page in the order given. */
export type Block =
	| { kind: 'text'; text: string; lead?: boolean }
	/** What to do, in order: numbered, down the page. */
	| { kind: 'steps'; steps: Point[] }
	/** A picture the width of the page. */
	| { kind: 'figure'; figure: Figure }
	/** Two pictures side by side, made the same height. */
	| { kind: 'pair'; figures: [Figure, Figure] }
	/** Pictures down the page, each with what it shows beside it. */
	| { kind: 'rows'; rows: (Point & { figure: Figure })[] }
	/** Something to keep in mind, set apart. */
	| { kind: 'note'; note: Point }
	/** Short pieces side by side. */
	| { kind: 'columns'; columns: Point[] }
	/** Short pieces down the page, each named in the margin. */
	| { kind: 'list'; list: Point[] }
	/** Where to go: the site's address, as large as fits, with a line over it and one under. */
	| { kind: 'call'; over: string; under: string };

export interface ManualPage {
	section: string;
	headline: string;
	blocks: Block[];
}

/** A booklet of instructions for something that is on the web, which every page of it sends you to. */
export interface Manual {
	title: string;
	/** What kind of booklet it is, as its cover says. */
	kind: string;
	tagline: string;
	site: { name: string; href: string };
	pages: ManualPage[];
}

export interface Entry {
	id: string;
	label: string;
	/** Placeholder copy for the panel shown when the object is picked up. */
	blurb: string;
	/** What the panel has to read in place of that, for an object that is something to read. */
	article?: Article;
	manual?: Manual;
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
		blurb: 'A character sheet for Mothership, in its box.'
	},
	{
		// The booklet in the box: how mothersheet.com works, a page to each part of it. It is printed
		// on the booklet's pages (see manual.ts), with the screenshots in the assets' manual folder.
		id: 'manual',
		label: 'manual',
		blurb: 'In the box, on top.',
		manual: {
			title: 'Mothersheet',
			kind: 'Player’s Manual',
			tagline: 'A character sheet for Mothership that lives in your browser.',
			site: { name: 'mothersheet.com', href: 'https://mothersheet.com' },
			pages: [
				{
					section: 'What it is',
					headline: 'Your sheet, in a browser.',
					blocks: [
						{
							kind: 'text',
							lead: true,
							text: 'Mothersheet is a character sheet for Mothership that lives at mothersheet.com. It rolls your character, tracks everything that changes at the table, and keeps it all between sessions.'
						},
						{ kind: 'figure', figure: { art: 1, caption: 'A finished sheet, in play' } },
						{
							kind: 'columns',
							columns: [
								{ label: 'Free', text: 'No price and no trial. Open mothersheet.com and start.' },
								{ label: 'Nothing to install', text: 'It runs in the browser you already have open.' },
								{ label: 'Anywhere', text: 'Sign in, and your sheet is on whatever computer you sit down at.' }
							]
						}
					]
				},
				{
					section: 'Getting started',
					headline: 'Four steps to a character.',
					blocks: [
						{
							kind: 'steps',
							steps: [
								{
									label: 'Open the site',
									text: 'Go to mothersheet.com in any browser. That is the whole installation.'
								},
								{
									label: 'Sign in with Google',
									text: 'This is what lets your sheet open from any computer, with no new account to make and no password to remember.'
								},
								{
									label: 'Follow the wizard',
									text: 'It walks you through your class, stat adjustments and skills. It rolls every value for you, and hands you a random loadout.'
								},
								{
									label: 'Start playing',
									text: 'You land on your finished sheet. Everything on it can still be changed, so nothing the dice gave you is final.'
								}
							]
						},
						{
							kind: 'note',
							note: {
								label: 'What is kept',
								text: 'Your Google ID and the character sheet that goes with it. Nothing else is saved.'
							}
						}
					]
				},
				{
					section: 'Play and edit',
					headline: 'Color means clickable.',
					blocks: [
						{
							kind: 'text',
							lead: true,
							text: 'Whatever is in color is what you can click right now. In play mode that is everything that changes at the table: stress, health, conditions, ammo and your notes.'
						},
						{
							kind: 'text',
							text: 'Click the blue pencil in the top left corner for edit mode. The color moves to everything else: your name, class, stats, saves, skills and how much you can carry.'
						},
						{
							kind: 'pair',
							figures: [
								{ art: 1, crop: [0.004, 0, 0.329, 0.45], caption: 'Play mode' },
								{ art: 2, crop: [0.004, 0, 0.329, 0.45], caption: 'Edit mode' }
							]
						},
						{
							kind: 'note',
							note: {
								label: 'Saving',
								text: 'In play mode every change is saved as you make it. In edit mode nothing is saved until you click the save button, which is also the way back to play mode.'
							}
						},
						{
							kind: 'text',
							text: 'Roll a throwaway character at mothersheet.com and try both.'
						}
					]
				},
				{
					section: 'Equipment',
					headline: 'Carry some. Store the rest.',
					blocks: [
						{
							kind: 'text',
							lead: true,
							text: 'You start with an item slot for every five points of Strength, rounded up, and edit mode will raise or lower that, up to ten. Whatever you are not carrying goes in your storage locker.'
						},
						{
							kind: 'rows',
							rows: [
								{
									label: 'Putting it down',
									text: 'Remove an item and you are asked what becomes of it: drop it for good, or store it in the locker.',
									figure: { art: 3, caption: 'Removing an item' }
								},
								{
									label: 'Picking it up',
									text: 'An empty slot asks the same question the other way round: a new item, or one back out of storage.',
									figure: { art: 4, caption: 'Filling a slot' }
								},
								{
									label: 'The locker',
									text: 'It has no limit, and remembers the state, quantity and ammo of everything in it. Custom Thingy, here, is an empty custom gun.',
									figure: { art: 5, caption: 'The storage locker' }
								}
							]
						},
						{
							kind: 'text',
							text: 'Your locker is kept with your sheet at mothersheet.com, so nothing is lost between sessions.'
						}
					]
				},
				{
					section: 'Items, armor and weapons',
					headline: 'Make it. Break it. Reload it.',
					blocks: [
						{
							kind: 'text',
							lead: true,
							text: 'Most of the standard gear is built in. For everything else there are custom items: armor, consumables and weapons of your own.'
						},
						{
							kind: 'pair',
							figures: [
								{ art: 6, caption: 'Making custom armor' },
								{ art: 7, caption: 'Broken armor, waiting on a repair' }
							]
						},
						{
							kind: 'columns',
							columns: [
								{
									label: 'Armor',
									text: 'Click the armor shield when what you are wearing takes the hit, and it is marked broken. It stays broken until you repair it.'
								},
								{
									label: 'Weapons',
									text: 'Click the shot count or the lightning bolt to spend a shot. The up arrows reload the weapon from the ammo in your inventory.'
								}
							]
						},
						{
							kind: 'text',
							text: 'See what is already in the armory at mothersheet.com before you build your own.'
						}
					]
				},
				{
					section: 'Everything else',
					headline: 'And the rest of the sheet.',
					blocks: [
						{
							kind: 'list',
							list: [
								{
									label: 'Skills',
									text: 'The skill tree keeps track of what you are eligible for. The standard skills are all there, and you can add your own.'
								},
								{
									label: 'Conditions',
									text: 'The usual ones are built in, and custom ones cover whatever your Warden comes up with.'
								},
								{
									label: 'Shore leave',
									text: 'Training and treatment work as they did in the original beta rules. If your table does not use them, they are easy to ignore.'
								},
								{
									label: 'Death',
									text: 'When your health reaches zero you are given the choice: revive the character, or roll up a new one.'
								},
								{
									label: 'Notes',
									text: 'A big notes section, for anything else you have going on.'
								}
							]
						},
						{
							kind: 'call',
							over: 'Your sheet is waiting. Free to use at',
							under: 'There is a donation button on the site for the hosting costs. It is appreciated and never expected.'
						}
					]
				}
			]
		}
	},
	...['one', 'two', 'three', 'four', 'five', 'six', 'seven'].map((n, i) => ({
		id: `flier-${i + 1}`,
		label: `flier ${n}`,
		blurb: 'A flier for a show in Richmond.'
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
