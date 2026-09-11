import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-4 text-center text-ink-100">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-duck-500/30 bg-duck-500/10 text-2xl mb-4">
        🦆
      </div>
      <h1 className="text-2xl font-bold text-ink-100">Page Not Found</h1>
      <p className="mt-2 text-sm text-ink-400">The requested page could not be found.</p>
      <Link
        href="/workspace"
        className="mt-6 inline-flex items-center rounded-xl bg-duck-400 px-4 py-2 text-xs font-bold text-ink-950 hover:bg-duck-300 transition-all"
      >
        Return to Workspace
      </Link>
    </div>
  );
}
