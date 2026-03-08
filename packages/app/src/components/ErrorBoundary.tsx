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
        <div className="card-gradient rounded-xl p-5 flex items-center justify-between">
          <span className="text-sm text-white/40">
            {this.props.label ?? "Card"} failed to load
          </span>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-xs border border-white/20 rounded px-3 py-1 hover:bg-white/5 transition-colors"
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
        <div className="flex-1 flex flex-col items-center justify-center gap-4 py-16 px-6 text-center">
          <div className="text-4xl">&#x26A0;&#xFE0F;</div>
          <h3 className="text-xl font-semibold">
            {this.props.fallbackTitle || "Something went wrong"}
          </h3>
          <p className="text-white/50 text-sm max-w-sm">
            An unexpected error occurred. Please try again or return home.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="border border-white/20 rounded-lg px-5 py-2 text-sm hover:bg-white/5 transition-colors"
            >
              Try again
            </button>
            <Link
              href="/"
              className="bg-cyan text-black font-semibold rounded-lg px-5 py-2 text-sm hover:bg-cyan/90 transition-all"
            >
              Go home
            </Link>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
