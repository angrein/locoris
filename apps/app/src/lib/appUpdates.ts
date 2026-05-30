import {
  checkForAndroidUpdate,
  initializeAndroidUpdateState,
  installAvailableAndroidUpdate,
  openAndroidInstallPermissionSettings,
  openAndroidUpdateReleasePage,
  readAndroidUpdateSnapshot,
  retryFailedAndroidUpdateInstall,
  startAutomaticAndroidUpdateCheck,
  subscribeAndroidUpdateState,
  supportsAndroidUpdates,
  type AndroidUpdateIssueCode,
  type AndroidUpdatePhase,
  type AndroidUpdateSnapshot
} from "./androidUpdates";
import {
  checkForDesktopUpdate,
  initializeDesktopUpdateState,
  installAvailableDesktopUpdate,
  openDesktopUpdateReleasePage,
  readDesktopUpdateSnapshot,
  retryFailedDesktopUpdateInstall,
  startAutomaticDesktopUpdateCheck,
  subscribeDesktopUpdateState,
  supportsDesktopUpdates,
  type DesktopUpdateIssueCode,
  type DesktopUpdatePhase,
  type DesktopUpdateSnapshot
} from "./desktopUpdates";

export type AppUpdateKind = "desktop" | "android" | "unsupported";
export type AppUpdateIssueCode =
  | DesktopUpdateIssueCode
  | AndroidUpdateIssueCode;
export type AppUpdatePhase = DesktopUpdatePhase | AndroidUpdatePhase;

export type AppUpdateSnapshot = Omit<
  DesktopUpdateSnapshot | AndroidUpdateSnapshot,
  "phase" | "issueCode"
> & {
  kind: AppUpdateKind;
  phase: AppUpdatePhase;
  issueCode: AppUpdateIssueCode | null;
};

function withKind(
  snapshot: DesktopUpdateSnapshot | AndroidUpdateSnapshot,
  kind: AppUpdateKind
): AppUpdateSnapshot {
  return {
    ...snapshot,
    kind
  };
}

export function supportsAppUpdates() {
  return supportsDesktopUpdates() || supportsAndroidUpdates();
}

export function getAppUpdateKind(): AppUpdateKind {
  if (supportsAndroidUpdates()) {
    return "android";
  }

  if (supportsDesktopUpdates()) {
    return "desktop";
  }

  return "unsupported";
}

export function readAppUpdateSnapshot() {
  if (supportsAndroidUpdates()) {
    return withKind(readAndroidUpdateSnapshot(), "android");
  }

  if (supportsDesktopUpdates()) {
    return withKind(readDesktopUpdateSnapshot(), "desktop");
  }

  return withKind(readDesktopUpdateSnapshot(), "unsupported");
}

export function subscribeAppUpdateState(listener: (snapshot: AppUpdateSnapshot) => void) {
  if (supportsAndroidUpdates()) {
    return subscribeAndroidUpdateState((snapshot) => listener(withKind(snapshot, "android")));
  }

  if (supportsDesktopUpdates()) {
    return subscribeDesktopUpdateState((snapshot) => listener(withKind(snapshot, "desktop")));
  }

  listener(readAppUpdateSnapshot());
  return () => undefined;
}

export async function initializeAppUpdateState() {
  if (supportsAndroidUpdates()) {
    await initializeAndroidUpdateState();
    return;
  }

  await initializeDesktopUpdateState();
}

export async function checkForAppUpdate(options?: { quiet?: boolean }) {
  if (supportsAndroidUpdates()) {
    return withKind(await checkForAndroidUpdate(options), "android");
  }

  return withKind(await checkForDesktopUpdate(options), getAppUpdateKind());
}

export async function startAutomaticAppUpdateCheck() {
  if (supportsAndroidUpdates()) {
    await startAutomaticAndroidUpdateCheck();
    return;
  }

  await startAutomaticDesktopUpdateCheck();
}

export async function installAvailableAppUpdate() {
  if (supportsAndroidUpdates()) {
    await installAvailableAndroidUpdate();
    return;
  }

  await installAvailableDesktopUpdate();
}

export async function retryFailedAppUpdateInstall() {
  if (supportsAndroidUpdates()) {
    await retryFailedAndroidUpdateInstall();
    return;
  }

  await retryFailedDesktopUpdateInstall();
}

export async function openAppUpdateReleasePage(version?: string | null) {
  if (supportsAndroidUpdates()) {
    await openAndroidUpdateReleasePage(version);
    return;
  }

  await openDesktopUpdateReleasePage(version);
}

export async function resolveAppUpdatePermissionIssue() {
  if (supportsAndroidUpdates()) {
    await openAndroidInstallPermissionSettings();
  }
}
