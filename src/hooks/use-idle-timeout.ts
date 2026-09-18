import { useEffect, useRef, useState } from "react";

export const IDLE_TIMEOUT_MS = 20 * 60 * 1000;
export const IDLE_WARNING_MS = 60 * 1000;

const STORAGE_KEY = "blexware.lastActivityAt";
const WRITE_THROTTLE_MS = 5_000;
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "wheel",
  "focus",
] as const;

function readLastActivity(): number {
  if (typeof window === "undefined") return Date.now();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function writeLastActivity(at: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(at));
  } catch {
    /* storage unavailable — timer still works in-tab */
  }
}

export function clearIdleActivity() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type Options = {
  timeoutMs?: number;
  warningMs?: number;
  onTimeout: () => void;
};

/**
 * Tracks user activity across tabs (localStorage) and fires onTimeout once the
 * idle window elapses. `warning` turns true during the final `warningMs`.
 */
export function useIdleTimeout({
  timeoutMs = IDLE_TIMEOUT_MS,
  warningMs = IDLE_WARNING_MS,
  onTimeout,
}: Options) {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(warningMs / 1000));
  const firedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWriteRef = useRef(0);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Seed on mount: a fresh load counts as activity only if none is recorded.
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      writeLastActivity(Date.now());
    }

    const clearTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };

    const tick = () => {
      if (firedRef.current) return;
      const idleFor = Date.now() - readLastActivity();
      const remaining = timeoutMs - idleFor;

      if (remaining <= 0) {
        firedRef.current = true;
        clearTimer();
        setWarning(false);
        onTimeoutRef.current();
        return;
      }

      if (remaining <= warningMs) {
        setWarning(true);
        setSecondsLeft(Math.max(1, Math.ceil(remaining / 1000)));
        timerRef.current = setTimeout(tick, 1000);
        return;
      }

      setWarning(false);
      timerRef.current = setTimeout(tick, Math.min(remaining - warningMs, 30_000));
    };

    const markActive = () => {
      if (firedRef.current) return;
      const now = Date.now();
      if (now - lastWriteRef.current >= WRITE_THROTTLE_MS) {
        lastWriteRef.current = now;
        writeLastActivity(now);
      }
      clearTimer();
      tick();
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      clearTimer();
      tick();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        clearTimer();
        tick();
      }
    };

    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, markActive, { passive: true });
    }
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    tick();

    return () => {
      clearTimer();
      for (const name of ACTIVITY_EVENTS) {
        window.removeEventListener(name, markActive);
      }
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [timeoutMs, warningMs]);

  const stayActive = () => {
    if (firedRef.current) return;
    lastWriteRef.current = Date.now();
    writeLastActivity(Date.now());
    setWarning(false);
  };

  return { warning, secondsLeft, stayActive };
}
