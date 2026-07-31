import Workspace from "@/components/Workspace";
import { MOCK_NOTE } from "@/lib/mockNote";

/**
 * Server component. Swap MOCK_NOTE for a fetch against
 * `GET /api/notes/[id]` (or a direct Supabase query) once notes are real —
 * the shapes already match.
 */
export default function Page() {
  return <Workspace note={MOCK_NOTE} />;
}
