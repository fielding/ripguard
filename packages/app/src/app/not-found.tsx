import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
      <div className="text-center space-y-4 px-6">
        <h2 className="text-2xl font-bold">404</h2>
        <p className="text-white/50 text-sm">Page not found.</p>
        <Link
          href="/"
          className="inline-block bg-cyan text-black font-semibold rounded-lg px-5 py-2 text-sm hover:bg-cyan/90 transition-all"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
