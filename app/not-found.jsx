import Link from "next/link";
import { MalloIcon } from "@/components/brand/Brand";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-950 px-4 text-center text-ink-100">
      <MalloIcon mood="dizzy" className="mb-5 h-16 w-16" title="Mallo, dizzy" />
      <h1 className="text-2xl font-bold text-ink-100">Page Not Found</h1>
      <p className="mt-2 text-sm text-ink-400">The requested page could not be found.</p>
      <Link
        href="/workspace"
        className="mt-6 inline-flex items-center rounded-xl bg-brand-400 px-4 py-2 text-xs font-bold text-ink-950 hover:bg-brand-300 transition-all"
      >
        Return to Workspace
      </Link>
    </div>
  );
}
