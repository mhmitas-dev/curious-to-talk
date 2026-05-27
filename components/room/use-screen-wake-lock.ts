"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ScreenWakeLockStatus =
  | "idle"
  | "requesting"
  | "active"
  | "released"
  | "blocked"
  | "unsupported";

export function useScreenWakeLock(active: boolean) {
  const [isEnabled, setIsEnabled] = useState(true);
  const [status, setStatus] = useState<ScreenWakeLockStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  const activeRef = useRef(active);
  const isEnabledRef = useRef(isEnabled);
  const requestIdRef = useRef(0);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    isEnabledRef.current = isEnabled;
  }, [isEnabled]);

  const releaseWakeLock = useCallback(async () => {
    requestIdRef.current += 1;
    const sentinel = sentinelRef.current;
    sentinelRef.current = null;

    if (sentinel && !sentinel.released) {
      try {
        await sentinel.release();
      } catch {
        // The browser may already have released the lock while visibility changed.
      }
    }
  }, []);

  const requestWakeLock = useCallback(async () => {
    await Promise.resolve();

    if (!activeRef.current || !isEnabledRef.current) {
      return;
    }

    if (typeof document === "undefined" || typeof navigator === "undefined") {
      return;
    }

    if (!("wakeLock" in navigator)) {
      setStatus("unsupported");
      setError("Screen wake lock is not supported in this browser.");
      return;
    }

    if (document.visibilityState !== "visible") {
      setStatus("released");
      return;
    }

    if (sentinelRef.current && !sentinelRef.current.released) {
      setStatus("active");
      setError(null);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setStatus("requesting");
    setError(null);

    try {
      const sentinel = await navigator.wakeLock.request("screen");

      if (
        requestIdRef.current !== requestId ||
        !activeRef.current ||
        !isEnabledRef.current
      ) {
        await sentinel.release();
        return;
      }

      sentinelRef.current = sentinel;
      sentinel.addEventListener(
        "release",
        () => {
          if (sentinelRef.current !== sentinel) {
            return;
          }

          sentinelRef.current = null;
          setStatus("released");
        },
        { once: true }
      );
      setStatus("active");
    } catch (requestError) {
      if (requestIdRef.current !== requestId) {
        return;
      }

      setStatus("blocked");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Screen wake lock could not be enabled."
      );
    }
  }, []);

  const toggle = useCallback(() => {
    if (status === "active" || status === "requesting") {
      setIsEnabled(false);
      setStatus("idle");
      setError(null);
      void releaseWakeLock();
      return;
    }

    setIsEnabled(true);
    void requestWakeLock();
  }, [releaseWakeLock, requestWakeLock, status]);

  useEffect(() => {
    if (!active || !isEnabled) {
      void releaseWakeLock().then(() => {
        if (!activeRef.current || !isEnabledRef.current) {
          setStatus("idle");
          setError(null);
        }
      });
      return;
    }

    void Promise.resolve().then(() => requestWakeLock());
  }, [active, isEnabled, releaseWakeLock, requestWakeLock]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [active, requestWakeLock]);

  useEffect(() => {
    return () => {
      void releaseWakeLock();
    };
  }, [releaseWakeLock]);

  return {
    error,
    isEnabled,
    status,
    toggle,
  };
}
