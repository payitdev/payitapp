import { useCallback } from "react";

interface HapticOptions {
  style?: "light" | "medium" | "heavy" | "rigid" | "soft" | "sharp";
}

export const triggerLightHaptic = () => {
  if (typeof window !== "undefined") {
    const tg = (window as any).Telegram?.WebApp?.HapticFeedback;
    if (tg?.impactOccurred) {
      try {
        tg.impactOccurred("light");
        return;
      } catch {}
    }
    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(10);
      } catch {}
    }
  }
};

export function useHaptics() {
  const trigger = useCallback((options: HapticOptions = {}) => {
    if (typeof window !== "undefined") {
      const tg = (window as any).Telegram?.WebApp?.HapticFeedback;
      if (tg) {
        const { style = "medium" } = options;
        (tg as any)[style]?.();
      }
    }
  }, []);

  const selectionChanged = useCallback(() => trigger({ style: "light" }), [trigger]);
  const impactOccurred = useCallback(() => trigger({ style: "medium" }), [trigger]);
  const notificationOccurred = useCallback(
    (type: "success" | "warning" | "error") => {
      trigger({ style: "heavy" });
    },
    [trigger]
  );

  return { trigger, selectionChanged, impactOccurred, notificationOccurred };
}
