import { DexieClimbRepo } from './dexieRepo';
import type { IClimbRepo } from './IClimbRepo';

// BC-21 — one shared repository instance for the whole app. Every page used to
// `new DexieClimbRepo()` on each render/effect, opening a fresh Dexie connection
// each time. This returns a single, lazily-constructed instance: one connection,
// and one place to swap when a sync-capable repo (BC-18) lands. Lazy construction
// means no Dexie is built during SSR — the first call happens inside a client effect.

let instance: IClimbRepo | undefined;

/** The single shared `IClimbRepo`, constructed on first use. */
export function getRepo(): IClimbRepo {
  return (instance ??= new DexieClimbRepo());
}
