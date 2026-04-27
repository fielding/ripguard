import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-6">
      <div className="text-center space-y-6 max-w-md">
        <div className="eyebrow text-cyan/70">404</div>
        <h2 className="text-h2">
          Wrong door.
          <br />
          <span className="text-cyan">Nothing locked here.</span>
        </h2>
        <p className="text-muted leading-relaxed">
          This page doesn&apos;t exist. Your vaults are fine.
        </p>
        <div className="pt-2">
          <Link href="/" className="btn-primary">
            Back to the front door
          </Link>
        </div>
      </div>
    </div>
  );
}
