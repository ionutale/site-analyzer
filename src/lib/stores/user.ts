import { writable } from 'svelte/store';
import type { User } from 'firebase/auth';
import { initAuth, signOutUser } from '$lib/auth/firebase';

export type UserSummary = {
	uid: string;
	displayName: string | null;
	email: string | null;
	photoURL: string | null;
};

function toSummary(u: User | null): UserSummary | null {
	if (!u) return null;
	return {
		uid: u.uid,
		displayName: u.displayName,
		email: u.email,
		photoURL: u.photoURL
	};
}

function createUserStore() {
	const { subscribe, set } = writable<UserSummary | null>(null);

	async function start() {
		await initAuth((u) => set(toSummary(u)));
	}

	async function signOut() {
		await signOutUser();
	}

	return { subscribe, start, signOut, set };
}

export const user = createUserStore();
