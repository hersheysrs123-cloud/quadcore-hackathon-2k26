"use client";

import { useCallback, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import BlockNoteEditor from "@/components/BlockNoteEditor";
import SocraticWorkspace from "@/components/SocraticWorkspace";
import { SPACES } from "@/lib/constants";
import {
  conceptFromText,
  editorBlocksToText,
  toEditorBlocks,
} from "@/lib/blocks";

/**
 * Shell state: which space is selected, the live editor content, and what the
 * Duck is currently interrogating.
 *
 * `duckConcept` deliberately survives closing — clearing it would blank the
 * drawer while it's still sliding out.
 */
export default function Workspace({ note }) {
  const [activeSpace, setActiveSpace] = useState(SPACES[0].name);
  const [duckConcept, setDuckConcept] = useState("");
  const [duckOpen, setDuckOpen] = useState(false);

  // Seed the editor from the note so the demo opens on real content, then let
  // the editor own it. setEditorBlocks is a stable setter, which is what
  // BlockNoteEditor's onBlocksChange effect requires.
  const seedBlocks = useMemo(() => toEditorBlocks(note), [note]);
  const [editorBlocks, setEditorBlocks] = useState(seedBlocks);

  // Whole-note context for the diagnostic, tracking live edits.
  const noteContent = useMemo(
    () => editorBlocksToText(editorBlocks),
    [editorBlocks],
  );

  // BlockNoteEditor hands us the selected block's text; the Duck wants a
  // concept label.
  const openDuck = useCallback((blockContent) => {
    setDuckConcept(conceptFromText(blockContent));
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
        <BlockNoteEditor
          initialBlocks={seedBlocks}
          onBlocksChange={setEditorBlocks}
          onTriggerSocratic={openDuck}
        />
      </main>

      <SocraticWorkspace
        open={duckOpen}
        concept={duckConcept}
        noteContent={noteContent}
        onClose={closeDuck}
      />
    </div>
  );
}
