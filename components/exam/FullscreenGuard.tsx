"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2 } from "lucide-react";

interface FullscreenGuardProps {
  onExitDetected: () => void;
  warningThreshold?: number; // auto-submit after N exits
}

export function FullscreenGuard({ onExitDetected, warningThreshold = 3 }: FullscreenGuardProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [exitCount, setExitCount] = useState(0);

  const requestFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen().catch(() => {
      // Fullscreen might be blocked — that's okay
    });
    setShowWarning(false);
  }, []);

  useEffect(() => {
    // Request fullscreen on mount
    requestFullscreen();

    function handleFullscreenChange() {
      if (!document.fullscreenElement) {
        setShowWarning(true);
        setExitCount((c) => c + 1);
        onExitDetected();
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [requestFullscreen, onExitDetected]);

  if (!showWarning) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-white rounded-xl p-8 max-w-md text-center space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold">Fullscreen Exited</h2>
        <p className="text-sm text-muted-foreground">
          This exam requires fullscreen mode. Exiting fullscreen has been logged.
          {exitCount >= warningThreshold && (
            <span className="block mt-2 text-destructive font-medium">
              Warning: Multiple fullscreen exits detected. Your session may be flagged.
            </span>
          )}
        </p>
        <Button onClick={requestFullscreen} className="w-full">
          <Maximize2 size={16} className="mr-2" />
          Return to Fullscreen
        </Button>
      </div>
    </div>
  );
}
