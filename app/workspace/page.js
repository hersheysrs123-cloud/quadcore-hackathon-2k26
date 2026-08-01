import Workspace from "@/components/Workspace";
import { MOCK_NOTE } from "@/lib/mockNote";

export const metadata = {
  title: "Workspace · SocraticOS",
  description: "Your notes, your Duck, your mastery map.",
};

/**
 * The app itself. This is what used to be rendered at "/" — the root is now
 * the landing page, which links here.
 */
export default function WorkspacePage() {
  return <Workspace note={MOCK_NOTE} />;
}
