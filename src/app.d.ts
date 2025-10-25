// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Svelte 5 reactive helper globals used in templates
	// Provide ambient declarations so TypeScript recognizes them.
	// At runtime, Svelte transforms these; we only need types here.
	// See: https://svelte.dev/docs/svelte/compat#reactivity-primitives
	const SvelteSet: SetConstructor;
	const SvelteURLSearchParams: typeof URLSearchParams;
}

export {};
