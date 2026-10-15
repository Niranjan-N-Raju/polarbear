"use client";

import { useEffect, useState } from "react";

/**
 * Drives a right-side drawer's slide-in/out transition.
 * Call `requestClose(action)` instead of firing a close callback directly so the
 * exit animation can play before the parent removes the drawer from the tree.
 */
export function useDrawerClose(durationMs = 200) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  function requestClose(action: () => void) {
    setVisible(false);
    setTimeout(action, durationMs);
  }

  return { visible, requestClose };
}

/**
 * Same transition, driven by a persistent `open` boolean instead of mount/unmount,
 * for drawers the parent keeps rendered and toggles via a prop.
 */
export function useDrawerVisibility(open: boolean, durationMs = 200) {
  const [shouldRender, setShouldRender] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      let raf1 = 0;
      let raf2 = 0;
      raf1 = requestAnimationFrame(() => {
        setShouldRender(true);
        raf2 = requestAnimationFrame(() => setVisible(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    let timeout: ReturnType<typeof setTimeout>;
    const raf = requestAnimationFrame(() => {
      setVisible(false);
      timeout = setTimeout(() => setShouldRender(false), durationMs);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (timeout) clearTimeout(timeout);
    };
  }, [open, durationMs]);

  return { shouldRender, visible };
}
