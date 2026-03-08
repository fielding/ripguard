"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 px-6">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-white/50 text-sm max-w-sm">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            className="border border-white/20 rounded-lg px-5 py-2 text-sm hover:bg-white/10 transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
