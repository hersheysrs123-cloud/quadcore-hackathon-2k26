"use client";

import { useCallback, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import NoteEditor from "@/components/NoteEditor";
import SocraticWorkspace from "@/components/SocraticWorkspace";
import { SPACES } from "@/lib/constants";
import { conceptFromBlock, noteToPlainText } from "@/lib/blocks";

/**
 * Owns the two pieces of shell state: which space is selected, and which block
 * the Duck is interrogating.
 *
 * `duckBlock` deliberately survives closing — nulling it would blank the drawer
 * while it's still sliding out.
 */
export default function Workspace({ note }) {
  const [activeSpace, setActiveSpace] = useState(SPACES[0].name);
  const [duckBlock, setDuckBlock] = useState(null);
  const [duckOpen, setDuckOpen] = useState(false);

  // The whole note is context for the diagnostic, not just the flagged block.
  const noteContent = useMemo(() => noteToPlainText(note), [note]);
  const concept = useMemo(() => conceptFromBlock(duckBlock), [duckBlock]);

  const openDuck = useCallback((block) => {
    setDuckBlock(block);
    setDuckOpen(true);
  }, []);

  const closeDuck = useCallback(() => setDuckOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        spaces={SPACES}
        activeSpace={activeSpace}
        onSelectSpace={setActiveSpace}
        note={note}
      />

      <main className="flex-1 overflow-y-auto">
        <NoteEditor
          note={note}
          activeSpace={activeSpace}
          onTalkToDuck={openDuck}
        />
      </main>

      <SocraticWorkspace
        open={duckOpen}
        concept={concept}
        noteContent={noteContent}
        onClose={closeDuck}
      />
    </div>
  );
}
