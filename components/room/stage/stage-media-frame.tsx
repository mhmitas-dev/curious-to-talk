"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

const STAGE_MEDIA_ASPECT_RATIO = 16 / 9;

interface StageMediaFrameProps {
  badge?: ReactNode;
  children: ReactNode;
}

interface FrameSize {
  height: number;
  width: number;
}

function getContainedFrameSize(width: number, height: number): FrameSize | null {
  if (width <= 0 || height <= 0) return null;

  const heightFromWidth = width / STAGE_MEDIA_ASPECT_RATIO;
  if (heightFromWidth <= height) {
    return {
      height: heightFromWidth,
      width,
    };
  }

  return {
    height,
    width: height * STAGE_MEDIA_ASPECT_RATIO,
  };
}

export function StageMediaFrame({ badge, children }: StageMediaFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState<FrameSize | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const updateFrameSize = (width: number, height: number) => {
      const nextSize = getContainedFrameSize(width, height);
      if (!nextSize) return;

      setFrameSize((currentSize) => {
        if (
          currentSize &&
          Math.abs(currentSize.width - nextSize.width) < 0.5 &&
          Math.abs(currentSize.height - nextSize.height) < 0.5
        ) {
          return currentSize;
        }

        return nextSize;
      });
    };

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      updateFrameSize(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(container);
    updateFrameSize(container.clientWidth, container.clientHeight);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-sidebar p-0 md:p-4"
    >
      <div
        className="relative overflow-hidden bg-black md:rounded-xl"
        style={
          frameSize
            ? {
                height: `${frameSize.height}px`,
                width: `${frameSize.width}px`,
              }
            : {
                aspectRatio: "16 / 9",
                width: "100%",
              }
        }
      >
        {badge}
        {children}
      </div>
    </div>
  );
}
