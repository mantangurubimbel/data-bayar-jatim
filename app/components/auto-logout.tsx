"use client";

import { useEffect, useRef } from "react";
import { signOut } from "@/app/auth/actions";

const idleTimeoutMs = 10 * 60 * 1000;

export function AutoLogout() {
  const timeoutRef = useRef<number | null>(null);
  const isLoggingOutRef = useRef(false);

  useEffect(() => {
    function clearLogoutTimer() {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    }

    function scheduleLogout() {
      clearLogoutTimer();
      timeoutRef.current = window.setTimeout(() => {
        if (isLoggingOutRef.current) {
          return;
        }

        isLoggingOutRef.current = true;
        void signOut();
      }, idleTimeoutMs);
    }

    const activityEvents = ["click", "keydown", "mousemove", "scroll", "touchstart", "visibilitychange"];

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, scheduleLogout, { passive: true });
    });

    scheduleLogout();

    return () => {
      clearLogoutTimer();
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, scheduleLogout);
      });
    };
  }, []);

  return null;
}
