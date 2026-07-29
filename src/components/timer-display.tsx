"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface TimerDisplayProps {
  isActive: boolean;
  durationMinutes: number;
  onFirstAnswer: () => void;
  onExpire: () => void;
  onWarning5: () => void;
  onWarning2: () => void;
  onWarning1: () => void;
}

export default function TimerDisplay({
  isActive,
  durationMinutes,
  onFirstAnswer,
  onExpire,
  onWarning5,
  onWarning2,
  onWarning1,
}: TimerDisplayProps) {
  const [display, setDisplay] = useState(formatTime(durationMinutes * 60));
  const [hidden, setHidden] = useState(false);
  const warned5 = useRef(false);
  const warned2 = useRef(false);
  const warned1 = useRef(false);
  const expiredRef = useRef(false);
  const firstAnswer = useRef(false);
  const startTime = useRef<number | null>(null);
  const pausedVisible = useRef(0);
  const lastTick = useRef<number | null>(null);

  const formatTimeDisplay = useCallback((totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const handleVisibility = () => {
      setHidden(document.hidden);
      if (!document.hidden && startTime.current !== null) {
        // Resume tracking visible time
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    const tick = () => {
      const now = Date.now();

      if (!firstAnswer.current) return; // Timer not yet started

      // Wall-clock elapsed
      const wallMs = now - startTime.current!;
      const wallCapMs = durationMinutes * 60 * 1000 * 2;

      if (wallMs >= wallCapMs) {
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpire();
        }
        return;
      }

      // Visible elapsed
      let visibleMs = pausedVisible.current;
      if (!document.hidden) {
        visibleMs += now - (lastTick.current || now);
      }
      lastTick.current = document.hidden ? lastTick.current : now;

      const remainingSec = Math.max(0, Math.ceil((durationMinutes * 60 * 1000 - visibleMs) / 1000));
      setDisplay(formatTimeDisplay(remainingSec));

      // Warnings
      if (remainingSec <= 300 && !warned5.current) {
        warned5.current = true;
        onWarning5();
      }
      if (remainingSec <= 120 && !warned2.current) {
        warned2.current = true;
        onWarning2();
      }
      if (remainingSec <= 60 && !warned1.current) {
        warned1.current = true;
        onWarning1();
      }

      // Expired
      if (remainingSec <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };

    const interval = setInterval(tick, 250);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isActive, durationMinutes, onExpire, onWarning5, onWarning2, onWarning1, formatTimeDisplay]);

  const triggerFirstAnswer = useCallback(() => {
    if (!firstAnswer.current) {
      firstAnswer.current = true;
      startTime.current = Date.now();
      lastTick.current = Date.now();
      onFirstAnswer();
    }
  }, [onFirstAnswer]);

  // Expose triggerFirstAnswer to parent via imperative handle pattern
  // For now, we attach it to window for simplicity
  useEffect(() => {
    (window as any).__timerFirstAnswer = triggerFirstAnswer;
    return () => {
      delete (window as any).__timerFirstAnswer;
    };
  }, [triggerFirstAnswer]);

  const colorClass = display.startsWith("00:0") || display.startsWith("00:1")
    ? "text-red-600 dark:text-red-400 font-bold"
    : display.startsWith("00:")
      ? "text-amber-600 dark:text-amber-400 font-semibold"
      : "text-text-secondary dark:text-text-dark-secondary";

  return (
    <div
      className="text-center"
      role="timer"
      aria-live="polite"
      aria-label="Time remaining"
    >
      <div className={`text-2xl font-mono ${colorClass}`}>
        {hidden ? "⏸" : display}
      </div>
      {hidden && (
        <div className="text-xs text-text-secondary dark:text-text-dark-secondary mt-1">
          Timer paused — tab hidden
        </div>
      )}
    </div>
  );
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
