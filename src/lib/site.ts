export const site = {
	name: 'Matt Dinkel',
	url: 'https://mdinkel.com',
	email: 'Matt@mdinkel.com',
	description:
		'Matt Dinkel - Fractional CTO/CISO and Engineering Leadership for startups and small businesses.'
};

export const mailto = `mailto:${site.email}`;

export function formatDate(date: string) {
	return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC'
	});
}
