"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { trackAppError } from "@/lib/analytics";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type CardProps = {
  children: ReactNode;
  label?: string;
};

type CardState = {
  hasError: boolean;
};

export class CardErrorBoundary extends Component<CardProps, CardState> {
  constructor(props: CardProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): CardState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    trackAppError({
      message: `CardError(${this.props.label ?? "unknown"}): ${error.message}`,
      componentStack: info.componentStack ?? undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border border-line rounded-xl p-5 flex items-center justify-between bg-surface">
          <span className="text-sm text-muted">
            {this.props.label ?? "Card"} failed to load.
          </span>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-xs border border-line-strong text-muted rounded px-3 py-1.5 hover:border-cyan hover:text-cyan transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught:", error, info);
    }
    trackAppError({
      message: error.message,
      componentStack: info.componentStack ?? undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 py-16 px-6 text-center">
          <div className="eyebrow text-cyan/70">Something broke</div>
          <h3 className="font-display text-2xl tracking-tight">
            {this.props.fallbackTitle || "Something went wrong"}
          </h3>
          <p className="text-muted text-sm max-w-sm leading-relaxed">
            An unexpected error hit. Your funds are not affected. Retry, or head home.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn-secondary"
            >
              Try again
            </button>
            <Link href="/" className="btn-primary">
              Go home
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
