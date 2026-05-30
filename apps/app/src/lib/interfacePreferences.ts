import { readPersistentString, writePersistentString } from "./persistentClientStorage";

export type OrbitalAnimationMode = "full" | "reduced";

export const ORBITAL_ANIMATION_MODE_STORAGE_KEY = "zen-notes.orbitalAnimationMode";
export const DEFAULT_ORBITAL_ANIMATION_MODE: OrbitalAnimationMode = "full";

const ORBITAL_ANIMATION_MODES = new Set<OrbitalAnimationMode>(["full", "reduced"]);

export function isOrbitalAnimationMode(value: unknown): value is OrbitalAnimationMode {
  return typeof value === "string" && ORBITAL_ANIMATION_MODES.has(value as OrbitalAnimationMode);
}

export function resolveOrbitalAnimationMode(value: unknown): OrbitalAnimationMode {
  return isOrbitalAnimationMode(value) ? value : DEFAULT_ORBITAL_ANIMATION_MODE;
}

export function readStoredOrbitalAnimationMode() {
  return resolveOrbitalAnimationMode(readPersistentString(ORBITAL_ANIMATION_MODE_STORAGE_KEY));
}

export function writeStoredOrbitalAnimationMode(mode: OrbitalAnimationMode) {
  writePersistentString(ORBITAL_ANIMATION_MODE_STORAGE_KEY, resolveOrbitalAnimationMode(mode));
}
