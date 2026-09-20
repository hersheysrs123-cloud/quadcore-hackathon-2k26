# AI tutoring, quizzes and mastery

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). Explain, tutor chat, reformatter, the Quizzes Studio, quiz generation and grading, and the mastery roll-up.

### 🤖 E. AI Tutoring, Structured Explanations & Reformatting
- **Interactive AI Tutor Doubt-Clearing Suite (`components/AITutorPanel.jsx` & `app/api/tutor/chat/route.js`)**:
  - Accessible via the **🧑‍🏫 AI Tutor** button in the top HUD action bar.
  - **Full Space Curriculum Feeding**: Dynamically resolves and feeds all uploaded documents marked as *"Fed to AI"* from `SpaceHubView.jsx` for the active space.
  - **Pedagogy Alignment**: Injects the active space's Academic Standard / Grade Level (IGCSE, IB HL, AP, College, Olympiad), AI Persona & Tone (Standard Examiner, Strict Examiner, Socratic Guide, Friendly Coach, Olympiad Mentor), and Strictness / Rigor level into the tutor prompt.
  - **Active Note Context**: Injects the active note's full text content so the learner can highlight doubts directly from their notes.
  - **KaTeX & LaTeX Math**: Real-time rendering of mathematical formulas, equations, matrices, and chemical notations using `MathText`.
  - **Quick Doubt Starters**: 1-click query pills (*"Explain this step-by-step with intuition"*, *"What are common exam traps here?"*, *"Give me a concrete real-world example"*, *"Derive the formula"*).
  - Clear history, copy responses, and unconstrained doubt dialogue.
- **Structured Concept Explainer (`app/api/explain/route.js`, `lib/aiService.js` & `components/ExplainPanel.jsx`)**: Generates structured breakdowns containing TL;DR summaries, mechanism steps, analogies with explicit breakdown boundaries, common misconceptions, worked examples, and check-yourself questions, rendered with rich inline Markdown (**bold**, *italic*, `code`) and live KaTeX LaTeX mathematical/scientific equations. Features robust mathematical healing including JSON wire single-backslash escape repair (`repairJsonLatexEscapes`), control character healing (`sanitizeMathText` repairing `\f` form-feed `\frac` and `\t` tab `\text` corruptions), discrete bare LaTeX extraction in prose without delimiters (`BARE_INLINE_LATEX_REGEX`), and global KaTeX macro registration (`"\\ext": "\\text{#1}"`).
- **Intelligent Note Reformatting (`app/api/reformat/route.js` & `lib/aiService.js`)**: Analyzes notes and restructures them into high-yield SocraticOS blocks (headings, callout cards with emoji icons, hierarchical sub-bullets with multi-level nesting via `level` schema, LaTeX display/inline math, collapsible toggles, code snippets, checklists, tables, and dividers) with automatic multi-chunk segmentation for long notes (`chunkNoteBlocks`), live progress updates (`Part X/Y...`), strict LaTeX formula enforcement across all equations, markdown preservation inside bullets and all blocks, instantaneous `Ctrl+Z` undo stack tracking, offline heuristic fallback recognizing indented markdown sub-bullets, and a top-center floating glassmorphic status banner with live progress indicator.
- **Quiz Drawer Assessment Engine (`components/QuizPanel.jsx`)**: Dedicated quiz assessment sidebar for active notes and selections, evaluating understanding through dynamic questions (5 multiple-choice, 3 short-answers; math block / value_input questions excluded from quick quizzes) and recording session scores directly into the mastery analytics store.
- **Client-Side AI Orchestration (`lib/aiService.js`)**: Allows users to provide their own Gemini API key stored privately in IndexedDB, calling Gemini directly from the client or falling back to server routes.

---

### 🎯 F. Dedicated Quizzes Studio, AI Generator & Mastery Rollup
- **Quizzes Studio Tab (`components/QuizStudioView.jsx`)**:
  - Full diagnostic quiz hub organizing quizzes across spaces with pending, completed, and trash sub-tabs.
  - **Redesigned Decluttered Exam Runner Layout**: Split-screen 2-column workspace removing all navigation, submission, question jumper, and auxiliary buttons from the question canvas into a dedicated, high-productivity right-hand Control & Navigation Sidebar.
    - **Spacious Left/Center Q&A Canvas (`max-w-4xl`)**: Generous, distraction-free reading area featuring question metadata pills (number, subtopic with LaTeX MathText, question type), an open prompt card with rich KaTeX math typography, and expansive answer options (full-width MCQ cards with hover key hints, or spacious short/long answer textareas with mechanistic tips and live word counts).
    - **Dedicated Right-Hand Navigation & Control Station (`w-80 lg:w-88`)**:
      - Primary Action: Prominent "Next Question" / "Skip Question" button, transitioning automatically to "Finish & Submit Exam" on the last question.
      - Secondary Actions: "Previous Question" and instantaneous "Clear Answer" button.
      - Interactive Questions Matrix: 5-column numbered matrix showing real-time question states (Current glowing ring, Answered emerald pill with dot, Unanswered subtle badge) with single-click jumping to any question.
      - Progress & Real-Time Auto-Save: Continuous progress percentage bar, answered question counter, and local storage auto-save indicator.
      - Standalone Submit & Exit: Instant "Submit Exam" button accessible at any point, plus "Save Progress & Exit" to safely pause and return.
    - **Keyboard Hotkey Engine**: Global keyboard listeners: `ArrowRight` (next/skip), `ArrowLeft` (previous), and `A`/`B`/`C`/`D` or `1`/`2`/`3`/`4` to select multiple choice options.
  - **Progress Auto-Saving**: Real-time auto-saving of answers (`draftAnswers`) and active question position (`draftIndex`) to IndexedDB on option clicks, debounced textarea inputs, and question navigation.
  - **Full LaTeX & Chemical Formula Rendering (`components/MathText.jsx` & `lib/mathUtils.js`)**: All quiz prompts, subtopics, multiple choice options, diagnostic rubrics, student answers, and feedback render formatted mathematical equations and chemical formulas via memoized KaTeX compilation.
  - **Resume & In-Progress Flows**: In-progress quizzes display a `⏳ In Progress (X/Y)` card badge and `"Resume Quiz"` button restoring answers and current question index; retake cleanly resets draft state.
  - **Delete Confirmation Modal (`DeleteQuizConfirmModal`)**: Modal dialog with accessible semantics, metadata preview, and escape/backdrop dismiss preventing accidental loss when trashing quizzes, permanently deleting items, or emptying the 24-hour trash bin.
  - **Diagnostic Review Report**: High-contrast question breakdown cards (emerald for correct, rose for incorrect) with overall score (`ScoreRing.jsx`), subtopic confidence heatmap breakdown (`ConfidenceHeatmap.jsx`), and rubric feedback.
  - **Decluttered Multi-Note Quiz Cards & SourceNotesModal**: Multi-note quizzes render a single-line compact pill (`📚 X notes • View notes →`). Clicking opens `SourceNotesModal` with live search and 1-click note navigation into the editor.
  - 24-hour auto-purge trash management for deleted quizzes (`quizTrash`).
  - **Multi-Source Note Grading**: `handleSubmitQuiz` dynamically resolves full text across all source notes (`noteIds`) with structured boundaries, providing the AI grading model complete cross-note rubric context.
  - **Syllabus-Aware Grading**: `handleSubmitQuiz` reads the active syllabus statement and injects it into the grading payload.

- **Custom AI Quiz Generator Modal (`components/CreateQuizModal.jsx`)**:
  - **Multi-Note Selection**: Interactive source note combobox with live search filtering, "Select All" / "Clear" buttons, per-note checkboxes, selection count badge (`X of Y selected`), and removable chip badges.
  - **Multi-Source AI Prompt Feeding**: Formats all selected notes with clear section delimiters (`=== Source Note: "<Title>" ===`), prompting the AI model to synthesize cross-topic connections.
  - **Cross-Note Heading Aggregation**: When selecting specific sections (`scope === "heading"`), headings (H1–H4) from all selected notes are compiled with note source attribution (`[Note Title] Heading Text`).
  - Configurable difficulty tiers (Easy, Medium, Hard, Mastery) and custom note scoping (All Selected Notes, H1–H4 Heading Checkboxes, or Custom Prompt).
  - **Question Types (7 Supported)**:
    1. `multiple_choice`: 4 options (A-D / 1-4) with deterministic integer grading and hotkey selection.
    2. `multi_select`: Checkbox-style ("Select all that apply", 2+ correct options) with objective array set matching.
    3. `value_input`: Exact numerical or algebraic formula input with virtual math symbol keyboard (`\frac{a}{b}`, `\sqrt{x}`, `x^2`, `x^n`, `\pi`, `\pm`, `\theta`, `\le`, `\ge`, `\approx`, `\infty`, `\times`, `\div`, `^\circ`) and live KaTeX preview card. Deterministic match with numerical tolerance ($\pm \delta$), falling back to LLM for algebraic equivalence.
    4. `step_ordering`: Parsons problem scrambled derivations/proofs where students arrange mathematical or algorithmic steps into logical order using ▲/▼ controls.
    5. `code_input`: Algorithm/programming task with built-in code editor featuring 2-space `Tab` key indentation interception, monospace styling, language tags, and optional starter code.
    6. `short_answer`: Concise mechanistic free response graded via LLM rubric.
    7. `long_answer`: In-depth essay/derivation evaluated across structured criteria.
  - **1-Click STEM Presets**:
    - 🎓 **IGCSE Gr.10 STEM**: Balanced distribution (3 MCQ, 1 Multi-Select, 2 Value Input, 1 Step Order, 1 Code, 2 Short Answer).
    - 🧮 **Pure Math & Derivations**: Focused on mathematical rigor (2 MCQ, 3 Value Input, 2 Step Order, 1 Multi-Select).
    - 💻 **Computer Science**: Algorithm design & logic (2 MCQ, 3 Code Input, 1 Step Order, 1 Multi-Select).
    - ⚡ **Quick 5 MCQ**: Rapid 5-question multiple choice diagnostic.
  - **Categorized Question Sliders**: Grouped cleanly into *Mathematics & Science Reasoning* (Value Input, Step Ordering, Code Input), *Objective Assessment* (Multiple Choice, Multi-Select), and *Applied Analysis* (Short Answer, Long Essay).
  - Proportional question type sliders with custom gold gradient track fills and direct number inputs.
  - **Active Syllabus Badge**: Displays a green badge when a syllabus boundary is active and injects the syllabus into generation payloads.
  - **Spacious Wide Modal Architecture**: Upgraded modal shell (`w-full max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh]`) with responsive 2-column grid for section headings.

- **Objective & Semantic Hybrid Grading (`lib/aiService.js` & `app/api/quiz/grade/route.js`)**:
  - Deterministic evaluation:
    - `multiple_choice`: integer index comparison with strict blank guards.
    - `multi_select`: exact set equality across selected index arrays.
    - `step_ordering`: exact string sequence comparison against expected step order.
    - `value_input`: string normalization (stripping `$`), direct text equality, or float comparison within `tolerance` ($\pm \delta$).
  - LLM semantic evaluation for short answers, essays, code solutions, and algebraic derivations with positional fallback resilience and subtopic heatmap fallback synthesis (`fallbackHeatmap`).

- **Space-Specific Reactive Mastery Dashboard Sync (`components/Workspace.jsx`, `MasteryDashboard.jsx`, & `lib/mastery.js`)**:
  - `useLiveQuery` reactive binding synchronizing study sessions from both drawer quizzes and Quizzes Studio directly into `MasteryDashboard.jsx` and header `gapCount` badge without requiring page reload.
  - Full space-specific isolation: sessions, topics, averages, and the header `gapCount` badge are scoped to the active space by default.
  - Quick Space Switcher Dropdown in the Mastery header enabling instant toggling between spaces or viewing a combined `🌐 All Spaces` aggregate view.
  - Non-destructive backwards compatibility: historical sessions lacking an explicit space property automatically resolve to their associated note's space or default to `"School"`.
  - Isolated history clearing: "Clear history" removes only sessions within the selected space.
  - Sub-topic confidence matrix (Solid ● / Shaky ◐ / Gap ○) with weakest-first study queues and progress trends.

---
