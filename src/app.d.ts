// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	/** The side this build serves at the top level. Set from DEFAULT_SIDE in vite.config.ts. */
	const __DEFAULT_SIDE__: 'work' | 'personal';

	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** The shelf object currently picked up (personal side), so Back puts it down. */
			picked?: string;
		}
		// interface Platform {}
	}
}

export {};
