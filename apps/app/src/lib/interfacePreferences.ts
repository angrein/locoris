import { readPersistentString, writePersistentString } from "./persistentClientStorage";

export type OrbitalAnimationMode = "full" | "reduced";
export type OrbitalTemporalSignalsMode = "enabled" | "disabled";

export const ORBITAL_ANIMATION_MODE_STORAGE_KEY = "zen-notes.orbitalAnimationMode";
export const ORBITAL_TEMPORAL_SIGNALS_STORAGE_KEY = "zen-notes.orbitalTemporalSignals";
export const DEFAULT_ORBITAL_ANIMATION_MODE: OrbitalAnimationMode = "full";
export const DEFAULT_ORBITAL_TEMPORAL_SIGNALS_MODE: OrbitalTemporalSignalsMode = "enabled";

const ORBITAL_ANIMATION_MODES = new Set<OrbitalAnimationMode>(["full", "reduced"]);
const ORBITAL_TEMPORAL_SIGNALS_MODES = new Set<OrbitalTemporalSignalsMode>(["enabled", "disabled"]);

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

export function isOrbitalTemporalSignalsMode(value: unknown): value is OrbitalTemporalSignalsMode {
  return (
    typeof value === "string" &&
    ORBITAL_TEMPORAL_SIGNALS_MODES.has(value as OrbitalTemporalSignalsMode)
  );
}

export function resolveOrbitalTemporalSignalsMode(value: unknown): OrbitalTemporalSignalsMode {
  return isOrbitalTemporalSignalsMode(value) ? value : DEFAULT_ORBITAL_TEMPORAL_SIGNALS_MODE;
}

export function readStoredOrbitalTemporalSignalsMode() {
  return resolveOrbitalTemporalSignalsMode(readPersistentString(ORBITAL_TEMPORAL_SIGNALS_STORAGE_KEY));
}

export function writeStoredOrbitalTemporalSignalsMode(mode: OrbitalTemporalSignalsMode) {
  writePersistentString(ORBITAL_TEMPORAL_SIGNALS_STORAGE_KEY, resolveOrbitalTemporalSignalsMode(mode));
}
