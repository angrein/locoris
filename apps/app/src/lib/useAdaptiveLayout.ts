import { useEffect, useState } from "react";

import {
  getRuntimeLayoutSnapshot,
  type AppRuntimeLayoutSnapshot
} from "./runtime";

function sameLayoutSnapshot(left: AppRuntimeLayoutSnapshot, right: AppRuntimeLayoutSnapshot) {
  return (
    left.runtimeKind === right.runtimeKind &&
    left.device === right.device &&
    left.orientation === right.orientation &&
    left.pointer === right.pointer &&
    left.width === right.width &&
    left.height === right.height
  );
}

export function useAdaptiveLayout() {
  const [snapshot, setSnapshot] = useState(() => getRuntimeLayoutSnapshot());

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncSnapshot = () => {
      const nextSnapshot = getRuntimeLayoutSnapshot();
      setSnapshot((current) =>
        sameLayoutSnapshot(current, nextSnapshot) ? current : nextSnapshot
      );
    };
    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

    syncSnapshot();
    window.addEventListener("resize", syncSnapshot);
    window.addEventListener("orientationchange", syncSnapshot);
    window.visualViewport?.addEventListener("resize", syncSnapshot);
    coarsePointerQuery.addEventListener("change", syncSnapshot);

    return () => {
      window.removeEventListener("resize", syncSnapshot);
      window.removeEventListener("orientationchange", syncSnapshot);
      window.visualViewport?.removeEventListener("resize", syncSnapshot);
      coarsePointerQuery.removeEventListener("change", syncSnapshot);
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.documentElement.dataset.locorisRuntime = snapshot.runtimeKind;
    document.documentElement.dataset.locorisDevice = snapshot.device;
    document.documentElement.dataset.locorisOrientation = snapshot.orientation;
    document.documentElement.dataset.locorisPointer = snapshot.pointer;
    document.documentElement.dataset.locorisMobileShell = snapshot.isMobileShell ? "true" : "false";
  }, [snapshot]);

  return snapshot;
}
