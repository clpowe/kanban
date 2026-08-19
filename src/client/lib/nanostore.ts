import { createSignal, onSettled } from "solid-js";

/**
 * Minimal nanostores → Solid 2 bridge.
 *
 * better-auth ships a Solid adapter (`better-auth/solid`), but it is built on
 * Solid 1 APIs (`solid-js/store`, path setters, `reconcile`). We use the
 * framework-agnostic client instead and bind its atoms here.
 */
export type ReadableAtom<T> = {
  get(): T;
  subscribe(listener: (value: T) => void): () => void;
  listen(listener: (value: T) => void): () => void;
};

export function useStore<T>(atom: ReadableAtom<T>): () => T {
  // Activate the atom so lazy stores start fetching before the first read.
  const unbindActivation = atom.listen(() => {});
  // createSignal narrows away function values; atoms hold data, not callables.
  const [value, setValue] = createSignal<T>(atom.get() as Exclude<T, Function>);
  unbindActivation();

  // onSettled is the Solid 2 lifecycle hook: it runs outside the owned scope
  // (so writes are allowed) and its return value is the cleanup.
  onSettled(() => {
    const unsubscribe = atom.subscribe((next) => setValue(() => next));
    return () => unsubscribe();
  });

  return value;
}
