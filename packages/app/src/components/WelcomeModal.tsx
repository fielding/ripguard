"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const STORAGE_KEY = "ripguard-onboarding-seen";

export function WelcomeModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // Intentional post-hydration setState: localStorage is client-only,
        // so reading it during render would cause an SSR hydration mismatch
        // (server has no storage). Deferring to mount is the correct pattern.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setShow(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // localStorage unavailable
    }
  }

  const dialogRef = useRef<HTMLDivElement>(null);

  // ESC key, focus trap, body scroll lock
  useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Auto-focus primary CTA
    requestAnimationFrame(() => {
      const cta = dialogRef.current?.querySelector<HTMLElement>("a[href]");
      cta?.focus();
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/85 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div
        ref={dialogRef}
        className="relative w-full sm:max-w-md bg-surface-strong border border-line-strong rounded-t-xl sm:rounded-xl p-7 sm:p-8 animate-[slideUp_0.25s_ease-out] pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center text-subtle hover:text-foreground transition-colors rounded focus-visible:outline-2 focus-visible:outline-cyan focus-visible:outline-offset-2"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="eyebrow mb-5 flex items-center gap-3">
          <span className="h-px w-8 bg-cyan/60" />
          Before you start
        </div>
        <h2 id="welcome-title" className="font-display text-3xl sm:text-4xl tracking-tight leading-[0.95]">
          Lock it
          <br />
          <span className="text-cyan">before you touch it.</span>
        </h2>

        <div className="mt-6 space-y-4 text-sm text-muted leading-relaxed max-w-[46ch]">
          <p>
            You already know the drill. Hit a win, give it back. The answer
            is a vault the degen in the middle can&apos;t open.
          </p>
          <p>
            One signature. Routes directly into Sablier. Non-cancelable.
            Non-transferable. No support ticket, no early exit.{" "}
            <span className="text-foreground">Start with $5.</span>
          </p>
        </div>

        {/* CTA */}
        <div className="mt-8 space-y-3">
          <Link
            href="/create"
            onClick={dismiss}
            className="btn-primary w-full"
          >
            Create a Lock
          </Link>
          <button
            onClick={dismiss}
            className="block w-full text-center text-xs text-faint hover:text-muted transition-colors py-1"
          >
            I&apos;ll look around first
          </button>
        </div>

        <p className="mt-6 text-[10px] tabular text-faint text-center tracking-wider uppercase">
          RipGuard is the UI · Sablier is the bank
        </p>
      </div>
    </div>
  );
}
