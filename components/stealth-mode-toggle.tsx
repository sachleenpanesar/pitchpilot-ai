"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Eye, EyeOff, Shield, Sliders, Terminal, FileCode } from "lucide-react";

export interface StealthModeState {
  isPanicked: boolean;
  isVsCodeTheme: boolean;
  isTitleDisguised: boolean;
  opacity: number;
}

export interface StealthModeToggleProps {
  onStateChange?: (state: StealthModeState) => void;
  onPanicToggle?: (isPanicked: boolean) => void;
  onThemeToggle?: (isVsCodeTheme: boolean) => void;
  onTitleToggle?: (isTitleDisguised: boolean) => void;
  onOpacityChange?: (opacity: number) => void;
  className?: string;
  initialOpacity?: number;
  initialTitleDisguise?: boolean;
  initialVsCodeTheme?: boolean;
  initialPanic?: boolean;
}

export default function StealthModeToggle({
  onStateChange,
  onPanicToggle,
  onThemeToggle,
  onTitleToggle,
  onOpacityChange,
  className = "",
  initialOpacity = 1,
  initialTitleDisguise = false,
  initialVsCodeTheme = false,
  initialPanic = false,
}: StealthModeToggleProps) {
  const [isPanicked, setIsPanicked] = useState(initialPanic);
  const [isVsCodeTheme, setIsVsCodeTheme] = useState(initialVsCodeTheme);
  const [isTitleDisguised, setIsTitleDisguised] = useState(initialTitleDisguise);
  const [opacity, setOpacity] = useState(initialOpacity);
  const [isExpanded, setIsExpanded] = useState(false);

  const originalTitleRef = useRef<string>("");

  useEffect(() => {
    if (typeof document !== "undefined") {
      if (!originalTitleRef.current) {
        originalTitleRef.current = document.title || "PitchPilot AI";
      }
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isTitleDisguised) {
      document.title = "README.md - Visual Studio Code";
    } else if (originalTitleRef.current) {
      document.title = originalTitleRef.current;
    }
    return () => {
      if (originalTitleRef.current) {
        document.title = originalTitleRef.current;
      }
    };
  }, [isTitleDisguised]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isVsCodeTheme) {
      document.body.classList.add("vscode-theme");
    } else {
      document.body.classList.remove("vscode-theme");
    }
    return () => {
      document.body.classList.remove("vscode-theme");
    };
  }, [isVsCodeTheme]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isPanicked) {
      document.body.classList.add("panic-hidden");
      document.body.style.opacity = "0";
      document.body.style.visibility = "hidden";
    } else {
      document.body.classList.remove("panic-hidden");
      document.body.style.opacity = opacity.toString();
      document.body.style.visibility = "visible";
    }
    return () => {
      document.body.classList.remove("panic-hidden");
      document.body.style.opacity = "";
      document.body.style.visibility = "";
    };
  }, [isPanicked, opacity]);

  useEffect(() => {
    onStateChange?.({
      isPanicked,
      isVsCodeTheme,
      isTitleDisguised,
      opacity,
    });
  }, [isPanicked, isVsCodeTheme, isTitleDisguised, opacity, onStateChange]);

  const togglePanic = useCallback(() => {
    setIsPanicked((prev) => {
      const next = !prev;
      onPanicToggle?.(next);
      return next;
    });
  }, [onPanicToggle]);

  const toggleVsCodeTheme = useCallback(() => {
    setIsVsCodeTheme((prev) => {
      const next = !prev;
      onThemeToggle?.(next);
      return next;
    });
  }, [onThemeToggle]);

  const toggleTitleDisguise = useCallback(() => {
    setIsTitleDisguised((prev) => {
      const next = !prev;
      onTitleToggle?.(next);
      return next;
    });
  }, [onTitleToggle]);

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setOpacity(val);
      onOpacityChange?.(val);
    },
    [onOpacityChange]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isEsc = event.key === "Escape";
      const isCtrlShiftH =
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        (event.key === "H" || event.key === "h" || event.code === "KeyH");

      if (isEsc || isCtrlShiftH) {
        event.preventDefault();
        togglePanic();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [togglePanic]);

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePanic}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-sm transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            isPanicked
              ? "bg-amber-500 text-slate-950 hover:bg-amber-400 focus-visible:outline-amber-300"
              : "bg-red-600/90 text-white hover:bg-red-500 focus-visible:outline-red-400"
          }`}
          title="Panic Hide (Esc or Ctrl+Shift+H)"
        >
          {isPanicked ? <Eye className="h-3.5 w-3.5" aria-hidden="true" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />}
          <span>{isPanicked ? "Show Screen" : "Panic Hide (Esc)"}</span>
        </button>

        <button
          type="button"
          onClick={toggleVsCodeTheme}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            isVsCodeTheme
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300 focus-visible:outline-emerald-400"
              : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white focus-visible:outline-indigo-400"
          }`}
          title="Toggle VS Code Camouflage Theme"
        >
          <Terminal className="h-3.5 w-3.5" aria-hidden="true" />
          <span>VS Code Theme</span>
        </button>

        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          aria-expanded={isExpanded}
          aria-label="Stealth mode settings"
        >
          <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Stealth Controls</span>
        </button>
      </div>

      {isExpanded && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-black/80 ring-1 ring-white/10">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-white">Stealth Controls</h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">Esc / Ctrl+Shift+H</span>
          </div>

          <div className="mt-3.5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-300 mb-1.5">
                <span className="font-medium">Window Opacity</span>
                <span className="font-mono text-emerald-400">{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={opacity}
                onChange={handleOpacityChange}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-emerald-500"
                aria-label="Window opacity slider"
              />
            </div>

            <div className="flex items-center justify-between border-t border-zinc-800/80 pt-3">
              <label htmlFor="title-disguise-toggle" className="flex items-center gap-2 cursor-pointer">
                <FileCode className="h-4 w-4 text-indigo-400" aria-hidden="true" />
                <div>
                  <span className="block text-xs font-medium text-zinc-200">Title Disguise</span>
                  <span className="block text-[10px] text-zinc-500">Spoof window as VS Code</span>
                </div>
              </label>
              <input
                id="title-disguise-toggle"
                type="checkbox"
                checked={isTitleDisguised}
                onChange={toggleTitleDisguise}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-emerald-400"
              />
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-2.5 text-[11px] leading-relaxed text-zinc-400">
              <p className="font-semibold text-zinc-300">Quick Shortcuts:</p>
              <ul className="mt-1 space-y-1 text-[10px]">
                <li><kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-zinc-300">Esc</kbd> / <kbd className="rounded bg-zinc-800 px-1 py-0.5 font-mono text-zinc-300">Ctrl+Shift+H</kbd> Panic Blur</li>
                <li>Spoofs title to: <span className="font-mono text-zinc-300">README.md - Visual Studio Code</span></li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
