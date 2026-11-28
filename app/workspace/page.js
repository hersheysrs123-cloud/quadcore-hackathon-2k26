import Workspace from "@/components/Workspace";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Workspace · Learnory",
  description: "Your notes, Mallo and your mastery map, all in one place.",
};

/**
 * The app itself. This is what used to be rendered at "/" — the root is now
 * the landing page, which links here.
 */
export default function WorkspacePage() {
  return <Workspace />;
}
