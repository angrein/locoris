import { useEffect, useState } from "react";

function getVisualKeyboardInset() {
  if (typeof window === "undefined" || !window.visualViewport) {
    return 0;
  }

  const viewport = window.visualViewport;
  const inset = window.innerHeight - viewport.height - viewport.offsetTop;
  return Math.max(0, Math.round(inset));
}

export function useVisualKeyboardInset(enabled = true) {
  const [keyboardInset, setKeyboardInset] = useState(() => (enabled ? getVisualKeyboardInset() : 0));

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.visualViewport) {
      setKeyboardInset(0);
      return undefined;
    }

    let frame = 0;
    const syncInset = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setKeyboardInset(getVisualKeyboardInset());
      });
    };

    syncInset();
    window.visualViewport.addEventListener("resize", syncInset);
    window.visualViewport.addEventListener("scroll", syncInset);
    window.addEventListener("orientationchange", syncInset);

    return () => {
      window.cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener("resize", syncInset);
      window.visualViewport?.removeEventListener("scroll", syncInset);
      window.removeEventListener("orientationchange", syncInset);
    };
  }, [enabled]);

  return keyboardInset;
}
