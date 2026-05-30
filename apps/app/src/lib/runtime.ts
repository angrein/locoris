import { isTauri } from "@tauri-apps/api/core";

export type AppRuntimeKind = "web" | "desktop" | "android";
export type AppLayoutDevice = "desktop" | "tablet" | "phone";
export type AppLayoutOrientation = "landscape" | "portrait";
export type AppPointerMode = "fine" | "coarse";

export type AppRuntimeLayoutSnapshot = {
  runtimeKind: AppRuntimeKind;
  device: AppLayoutDevice;
  orientation: AppLayoutOrientation;
  pointer: AppPointerMode;
  width: number;
  height: number;
  isAndroid: boolean;
  isDesktop: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isTabletLandscape: boolean;
  isMobileShell: boolean;
};

const PHONE_MAX_SHORT_SIDE = 719;
const TABLET_LANDSCAPE_MIN_WIDTH = 1024;

function hasWindow() {
  return typeof window !== "undefined";
}

function getUserAgent() {
  return hasWindow() ? window.navigator.userAgent : "";
}

export function isTauriRuntime() {
  return hasWindow() && isTauri();
}

export function isAndroidRuntime() {
  return isTauriRuntime() && /Android/i.test(getUserAgent());
}

export function isDesktopRuntime() {
  return isTauriRuntime() && !isAndroidRuntime();
}

export function isWebRuntime() {
  return !isTauriRuntime();
}

export function getRuntimeKind(): AppRuntimeKind {
  if (isAndroidRuntime()) {
    return "android";
  }

  if (isDesktopRuntime()) {
    return "desktop";
  }

  return "web";
}

function getViewportSize() {
  if (!hasWindow()) {
    return {
      width: 1440,
      height: 900
    };
  }

  return {
    width: Math.round(window.visualViewport?.width ?? window.innerWidth),
    height: Math.round(window.visualViewport?.height ?? window.innerHeight)
  };
}

function getPointerMode(): AppPointerMode {
  if (!hasWindow()) {
    return "fine";
  }

  return window.matchMedia("(pointer: coarse)").matches ? "coarse" : "fine";
}

export function getRuntimeLayoutSnapshot(): AppRuntimeLayoutSnapshot {
  const runtimeKind = getRuntimeKind();
  const { width, height } = getViewportSize();
  const orientation: AppLayoutOrientation = width >= height ? "landscape" : "portrait";
  const pointer = getPointerMode();
  const shortSide = Math.min(width, height);
  const isAndroid = runtimeKind === "android";
  const isPhone = isAndroid && shortSide <= PHONE_MAX_SHORT_SIDE;
  const isTablet = isAndroid && !isPhone;
  const isTabletLandscape =
    isTablet && orientation === "landscape" && width >= TABLET_LANDSCAPE_MIN_WIDTH;
  const device: AppLayoutDevice = isPhone ? "phone" : isTablet ? "tablet" : "desktop";

  return {
    runtimeKind,
    device,
    orientation,
    pointer,
    width,
    height,
    isAndroid,
    isDesktop: runtimeKind === "desktop",
    isPhone,
    isTablet,
    isTabletLandscape,
    isMobileShell: isAndroid && !isTabletLandscape
  };
}
