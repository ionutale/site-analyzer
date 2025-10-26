import { browser } from '$app/environment';
import config from '$lib/firebase-config';
import { initializeApp, getApps } from 'firebase/app';
import {
	getAuth,
	GoogleAuthProvider,
	signInWithPopup,
	signInWithRedirect,
	onAuthStateChanged,
	signOut,
	setPersistence,
	browserLocalPersistence,
	type Auth,
	type User
} from 'firebase/auth';

let appInitialized = false;
let authInitialized = false;

export function ensureFirebase(): Auth | null {
	if (!browser) return null;
	if (!appInitialized) {
		if (getApps().length === 0) {
			initializeApp(config);
		}
		appInitialized = true;
	}
	const auth = getAuth();
	return auth;
}

export async function initAuth(onChange?: (user: User | null) => void) {
	if (!browser) return;
	const auth = ensureFirebase();
	if (!authInitialized) {
		if (auth) await setPersistence(auth, browserLocalPersistence);
		authInitialized = true;
	}
	if (auth) {
		onAuthStateChanged(auth, (u) => {
			onChange?.(u);
		});
	}
}

export async function signInWithGoogle() {
	const auth = ensureFirebase();
	const provider = new GoogleAuthProvider();
	try {
		if (auth) await signInWithPopup(auth, provider);
	} catch {
		// Fallback to redirect (e.g., iOS Safari popup blocked)
		if (auth) await signInWithRedirect(auth, provider);
	}
}

export async function signOutUser() {
	const auth = ensureFirebase();
	if (auth) await signOut(auth);
}
