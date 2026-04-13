"use client";

import { useEffect, useState, useRef } from "react";
import { Clock } from "lucide-react";

interface ExamTimerProps {
  totalSeconds: number;
  onExpire: () => void;
}

export function ExamTimer({ totalSeconds, onExpire }: ExamTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (remaining <= 0) {
      onExpireRef.current();
      return;
    }
    const timer = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(timer);
          onExpireRef.current();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isUrgent = remaining < 60;

  return (
    <div
      className={`flex items-center gap-2 font-mono font-bold text-lg px-3 py-1.5 rounded-lg border ${
        isUrgent ? "bg-red-50 border-red-200 text-red-700 animate-pulse" : "bg-muted"
      }`}
    >
      <Clock size={16} />
      {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
    </div>
  );
}
