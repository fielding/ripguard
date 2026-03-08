"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const STORAGE_KEY = "ripguard-onboarding-seen";

const STEPS = [
  {
    num: "1",
    title: "Pick a schedule",
    desc: "Choose a preset or build a custom lock. Panic Lock, 30-day hold, cliff + vest — whatever fits your vibe.",
  },
  {
    num: "2",
    title: "Lock your USDC",
    desc: "Approve and lock in one flow. Your funds go directly into the Sablier protocol — never through us.",
  },
  {
    num: "3",
    title: "Claim when it unlocks",
    desc: "Time passes, you claim. No cancel button. No exceptions. Your future self stays disciplined.",
  },
];

export function WelcomeModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
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
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
      onClick={dismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#111] p-7 sm:p-8 shadow-2xl animate-[slideUp_0.25s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-white/30 hover:text-white/60 transition-colors text-lg"
          aria-label="Close"
        >
          &#x2715;
        </button>

        {/* Header */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-cyan/20 bg-cyan/[0.08] mb-4">
            <svg className="w-6 h-6 text-cyan" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <h2 id="welcome-title" className="text-xl font-bold">Welcome to RipGuard</h2>
          <p className="text-sm text-white/40 mt-2">
            Lock your crypto winnings so you can&apos;t YOLO them back.
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-7">
          {STEPS.map((step) => (
            <div key={step.num} className="flex gap-3.5">
              <div className="w-8 h-8 rounded-full border border-cyan/20 bg-cyan/[0.06] flex items-center justify-center text-cyan text-sm font-bold shrink-0 mt-0.5">
                {step.num}
              </div>
              <div>
                <h3 className="font-semibold text-sm">{step.title}</h3>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/create"
          onClick={dismiss}
          className="block w-full bg-cyan text-black font-bold rounded-xl py-3.5 text-center text-sm hover:bg-cyan/90 transition-all hover:shadow-[0_0_30px_rgba(0,229,255,0.25)] active:scale-[0.98]"
        >
          Create Your First Lock
        </Link>
        <button
          onClick={dismiss}
          className="block w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors mt-3 py-1"
        >
          I&apos;ll look around first
        </button>

        <p className="text-[10px] text-white/15 text-center mt-4">
          Unaudited beta &middot; Start with a small test lock
        </p>
      </div>
    </div>
  );
}
