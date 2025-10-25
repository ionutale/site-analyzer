import { writable } from 'svelte/store';

export type ToastKind = 'success' | 'error' | 'info';

export type Toast = {
	id: string;
	kind: ToastKind;
	message: string;
	timeout?: number; // ms
};

function createToasts() {
	const { subscribe, update } = writable<Toast[]>([]);

	function push(kind: ToastKind, message: string, timeout = 3500) {
		const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const toast: Toast = { id, kind, message, timeout };
		update((arr) => [...arr, toast]);
		if (timeout && timeout > 0) {
			setTimeout(() => dismiss(id), timeout);
		}
		return id;
	}

	function dismiss(id: string) {
		update((arr) => arr.filter((t) => t.id !== id));
	}

	return {
		subscribe,
		push,
		dismiss,
		success: (msg: string, timeout?: number) => push('success', msg, timeout),
		error: (msg: string, timeout?: number) => push('error', msg, timeout),
		info: (msg: string, timeout?: number) => push('info', msg, timeout)
	};
}

export const toasts = createToasts();
