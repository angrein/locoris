import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { saveWindowState, StateFlags } from "@tauri-apps/plugin-window-state";

const DESKTOP_WINDOW_STATE_FLAGS =
  StateFlags.SIZE | StateFlags.POSITION | StateFlags.MAXIMIZED | StateFlags.FULLSCREEN;

function isDesktopRuntime() {
  return isTauri();
}

export async function saveDesktopWindowState() {
  if (!isDesktopRuntime()) {
    return;
  }

  await saveWindowState(DESKTOP_WINDOW_STATE_FLAGS);
}

export async function initializeDesktopWindowStatePersistence() {
  if (!isDesktopRuntime()) {
    return () => {};
  }

  const currentWindow = getCurrentWindow();
  const cleanupCallbacks: Array<() => void> = [];
  let pendingSaveTimer: number | null = null;
  let saveInFlight = false;
  let queuedSave = false;

  const flushWindowState = async () => {
    if (saveInFlight) {
      queuedSave = true;
      return;
    }

    saveInFlight = true;

    try {
      await saveDesktopWindowState();
    } finally {
      saveInFlight = false;

      if (queuedSave) {
        queuedSave = false;
        void flushWindowState();
      }
    }
  };

  const scheduleWindowStateSave = () => {
    if (pendingSaveTimer !== null) {
      window.clearTimeout(pendingSaveTimer);
    }

    pendingSaveTimer = window.setTimeout(() => {
      pendingSaveTimer = null;
      void flushWindowState();
    }, 180);
  };

  const onBeforeUnload = () => {
    void flushWindowState();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      scheduleWindowStateSave();
    }
  };

  window.addEventListener("beforeunload", onBeforeUnload);
  document.addEventListener("visibilitychange", onVisibilityChange);
  cleanupCallbacks.push(() => window.removeEventListener("beforeunload", onBeforeUnload));
  cleanupCallbacks.push(() => document.removeEventListener("visibilitychange", onVisibilityChange));

  const unlistenCallbacks = await Promise.all([
    currentWindow.onMoved(() => {
      scheduleWindowStateSave();
    }),
    currentWindow.onResized(() => {
      scheduleWindowStateSave();
    }),
    currentWindow.onFocusChanged(({ payload }) => {
      if (!payload) {
        scheduleWindowStateSave();
      }
    }),
    currentWindow.onCloseRequested(async () => {
      await flushWindowState();
    })
  ]);

  cleanupCallbacks.push(...unlistenCallbacks);

  return () => {
    if (pendingSaveTimer !== null) {
      window.clearTimeout(pendingSaveTimer);
      pendingSaveTimer = null;
    }

    for (const callback of cleanupCallbacks) {
      callback();
    }
  };
}
