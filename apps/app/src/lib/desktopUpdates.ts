import { isTauri } from "@tauri-apps/api/core";

import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { saveDesktopWindowState } from "./desktopWindowState";

export type DesktopUpdateCheckResult =
  | {
      status: "unsupported";
      currentVersion: null;
    }
  | {
      status: "up-to-date";
      currentVersion: string;
    }
  | {
      status: "available";
      currentVersion: string;
      nextVersion: string;
      body: string | null;
      date: string | null;
      update: Update;
    };

export function supportsDesktopUpdates() {
  return isTauri();
}

export async function getDesktopAppVersion() {
  if (!isTauri()) {
    return null;
  }

  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}

export async function checkForDesktopUpdate(): Promise<DesktopUpdateCheckResult> {
  const currentVersion = await getDesktopAppVersion();

  if (!isTauri() || !currentVersion) {
    return {
      status: "unsupported",
      currentVersion: null
    };
  }

  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();

  if (!update) {
    return {
      status: "up-to-date",
      currentVersion
    };
  }

  return {
    status: "available",
    currentVersion,
    nextVersion: update.version,
    body: update.body ?? null,
    date: update.date ?? null,
    update
  };
}

export async function installDesktopUpdate(
  update: Update,
  onProgress?: (event: DownloadEvent) => void
) {
  await saveDesktopWindowState().catch(() => {});

  const [{ relaunch }] = await Promise.all([
    import("@tauri-apps/plugin-process"),
    update.downloadAndInstall(onProgress)
  ]);

  await relaunch();
}
