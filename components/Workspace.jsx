"use client";

import { useCallback, useState } from "react";
import Sidebar from "@/components/Sidebar";
import NoteEditor from "@/components/NoteEditor";
import DuckPane from "@/components/DuckPane";
import { SPACES } from "@/lib/constants";

/**
 * Owns the two pieces of shell state: which space is selected, and which block
 * the Duck is interrogating.
 *
 * `duckBlock` deliberately survives closing — nulling it would blank the pane
 * while it's still sliding out.
 */
export default function Workspace({ note }) {
  const [activeSpace, setActiveSpace] = useState(SPACES[0].name);
  const [duckBlock, setDuckBlock] = useState(null);
  const [duckOpen, setDuckOpen] = useState(false);

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

      <DuckPane open={duckOpen} block={duckBlock} onClose={closeDuck} />
    </div>
  );
}
