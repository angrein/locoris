import { useEffect, useRef, type MutableRefObject } from "react";

import { isAndroidRuntime } from "./runtime";

const BACK_MARKER_KEY = "__locorisAndroidBackMarker";

type AndroidBackEntry = {
  id: number;
  marker: string;
  handledByHistoryBack: boolean;
  onBackRef: MutableRefObject<() => void>;
};

let nextAndroidBackEntryId = 1;
let androidBackEntries: AndroidBackEntry[] = [];
let androidBackListenersInstalled = false;
let suppressNextSyntheticPop = false;
let suppressResetTimer: number | null = null;

function getCurrentHistoryMarker() {
  const state = window.history.state;

  if (!state || typeof state !== "object") {
    return null;
  }

  const marker = (state as Record<string, unknown>)[BACK_MARKER_KEY];

  return typeof marker === "string" ? marker : null;
}

function getTopAndroidBackEntry() {
  return androidBackEntries[androidBackEntries.length - 1] ?? null;
}

function stopBackEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();

  if ("stopImmediatePropagation" in event) {
    event.stopImmediatePropagation();
  }
}

function handleAndroidHistoryBack(event: PopStateEvent) {
  if (suppressNextSyntheticPop) {
    suppressNextSyntheticPop = false;
    return;
  }

  const topEntry = getTopAndroidBackEntry();

  if (!topEntry) {
    return;
  }

  stopBackEvent(event);
  topEntry.handledByHistoryBack = true;
  topEntry.onBackRef.current();

  window.setTimeout(() => {
    const currentTopEntry = getTopAndroidBackEntry();

    if (currentTopEntry?.id !== topEntry.id) {
      return;
    }

    currentTopEntry.handledByHistoryBack = false;
    pushAndroidBackState(currentTopEntry.marker);
  }, 0);
}

function handleAndroidBackKey(event: KeyboardEvent) {
  if (event.key !== "Escape" && event.key !== "BrowserBack") {
    return;
  }

  const topEntry = getTopAndroidBackEntry();

  if (!topEntry) {
    return;
  }

  stopBackEvent(event);
  topEntry.onBackRef.current();
}

function installAndroidBackListeners() {
  if (androidBackListenersInstalled || typeof window === "undefined") {
    return;
  }

  window.addEventListener("popstate", handleAndroidHistoryBack, true);
  window.addEventListener("keydown", handleAndroidBackKey, true);
  androidBackListenersInstalled = true;
}

function uninstallAndroidBackListenersIfIdle() {
  if (!androidBackListenersInstalled || androidBackEntries.length > 0) {
    return;
  }

  window.removeEventListener("popstate", handleAndroidHistoryBack, true);
  window.removeEventListener("keydown", handleAndroidBackKey, true);
  androidBackListenersInstalled = false;
}

function pushAndroidBackState(marker: string) {
  const currentState =
    window.history.state && typeof window.history.state === "object"
      ? (window.history.state as Record<string, unknown>)
      : {};

  window.history.pushState(
    {
      ...currentState,
      [BACK_MARKER_KEY]: marker
    },
    ""
  );
}

function removeCurrentSyntheticBackState(marker: string) {
  if (getCurrentHistoryMarker() !== marker) {
    return;
  }

  suppressNextSyntheticPop = true;
  window.history.back();

  if (suppressResetTimer !== null) {
    window.clearTimeout(suppressResetTimer);
  }

  suppressResetTimer = window.setTimeout(() => {
    suppressNextSyntheticPop = false;
    suppressResetTimer = null;
  }, 120);
}

export function useAndroidBackHandler(active: boolean, onBack: () => void) {
  const onBackRef = useRef(onBack);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    if (!active || typeof window === "undefined" || !isAndroidRuntime()) {
      return undefined;
    }

    const id = nextAndroidBackEntryId;
    nextAndroidBackEntryId += 1;

    const entry: AndroidBackEntry = {
      id,
      marker: `locoris-android-back-${id}`,
      handledByHistoryBack: false,
      onBackRef
    };

    androidBackEntries.push(entry);
    installAndroidBackListeners();
    pushAndroidBackState(entry.marker);

    return () => {
      androidBackEntries = androidBackEntries.filter((candidate) => candidate.id !== entry.id);

      if (!entry.handledByHistoryBack) {
        removeCurrentSyntheticBackState(entry.marker);
      }

      uninstallAndroidBackListenersIfIdle();
    };
  }, [active, onBackRef]);
}
