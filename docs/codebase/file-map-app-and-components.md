# File map — app/ and components/

> Part of the [SocraticOS codebase reference](../../CODEBASE_SUMMARY.md). Every file under `app/` and the top-level `components/`. The 3D scene files are in [file-map-3d-visualizations.md](file-map-3d-visualizations.md).

```
quadcore-hackathon-2k26/
├── app/
│   ├── api/
│   │   ├── explain/route.js              # POST: Structured note explanation generator (uses normalizeExplanation from lib/aiService)
│   │   ├── quiz/generate/route.js        # POST: Diagnostic quiz generator with distractors (uses normalizeQuiz from lib/aiService)
│   │   ├── quiz/grade/route.js           # POST: Objective integer MC + LLM short answer grading (uses lib/aiService)
│   │   ├── reformat/route.js             # POST: Intelligent note reformatting generator (uses normalizeReformattedNote from lib/aiService)
│   │   └── tutor/chat/route.js           # POST: Interactive AI Tutor chat with space syllabus and academic pedagogy
│   ├── error.jsx                         # App Router root error boundary
│   ├── global-error.jsx                  # App Router HTML/root error boundary
│   ├── globals.css                       # Tailwind v4 tokens, light/dark themes, print stylesheet, KaTeX styles
│   ├── layout.js                         # Root layout, metadata & pre-paint theme bootstrap script
│   ├── not-found.jsx                     # App Router 404 not found page
│   ├── page.js                           # Marketing landing page (Server Component, CSS-only animations)
│   ├── visualizations/
│   │   └── page.jsx                      # Standalone 3D visualizer page with TopicSelectorDropdown, clean single header, & control HUD
│   └── workspace/
│       └── page.js                       # Main application page (renders <Workspace />)
├── components/
│   ├── AITutorPanel.jsx                  # Interactive AI Tutor drawer: real-time doubts, LaTeX math, quick prompts & space context
│   ├── AddBookmarkModal.jsx              # Quick add/edit bookmark modal with instant URL normalization & live favicon
│   ├── AlarmOverlay.jsx                  # Calming glassmorphic study break modal with gentle chime & snooze controls
│   ├── BlockNoteEditor.jsx               # 19-block Notion-style editor with slash menu, 6-dots handles, covers & stats
│   ├── CalendarView.jsx                  # Study schedule calendar, month navigation, agenda, Pomodoro integration & alarms
│   ├── CommandPalette.jsx                # Ctrl+K global fuzzy search modal for notes, bookmarks, views, and settings
│   ├── ConfidenceHeatmap.jsx             # Per-session sub-topic confidence heatmap (Solid / Shaky / Gap)
│   ├── CreateQuizModal.jsx               # Custom AI Quiz creator modal (difficulty, 7 question types, multi-note scope)
│   ├── Drawer.jsx                        # Non-blocking persistent side-by-side study sidebar container for Explain, Quiz & AI Tutor
│   ├── ExplainPanel.jsx                  # Structured LLM explanation sidebar (TL;DR, mechanism, analogies, misconceptions)
│   ├── ExportImportModal.jsx             # Multi-format export/import modal (.socratic, HTML Bookmarks, PDF, DOCX, HTML, TXT, MD)
│   ├── ExportPreview.jsx                 # High-fidelity document export preview for Word (.docx), HTML (.html), Plain Text (.txt), and Markdown (.md)
│   ├── FeatureRequestModal.jsx           # User feedback & feature request submission modal
│   ├── GlobalTimerHUD.jsx                # Unified header multi-timer dropdown with Pomodoro, breaks & custom timers
│   ├── InstantNoteModal.jsx              # Ctrl+I 75% screen quick note capture window with space selection
│   ├── InteractiveTutorial.jsx           # 9-chapter interactive onboarding walkthrough modal with live sandboxes & shortcuts
│   ├── MarkdownRenderer.jsx              # Universal rich Markdown renderer (headings, syntax-highlighted code, KaTeX math, tables, lists)
│   ├── MasteryDashboard.jsx              # Space-scoped topic mastery analytics dashboard, interactive space switcher & study recommendations
│   ├── MathText.jsx                      # Universal KaTeX LaTeX & chemical formula renderer for quiz prompts, options & rubrics
│   ├── NoteMenu.jsx                      # Note action menu (Favorite ⭐, 3 Typography Fonts, Note Stats, Full Width, Lock Page, Export/Import, Delete)
│   ├── QuizPanel.jsx                     # Study sidebar drawer: Dynamic AI diagnostic quiz runner, assessment evaluator & mastery tracker
│   ├── QuizStudioView.jsx                # Dedicated Quizzes Studio tab: 2-column exam runner, review reports, draft auto-save, trash management
│   ├── ScoreRing.jsx                     # Animated SVG score dial with status coloring
│   ├── Sidebar.jsx                       # Spaces selector (Grid & Dropdown views with EditSpaceModal), note list, multi-note bulk toolbar, 24h trash drawer, Settings modal & Typed RESET modal
│   ├── SpaceHubView.jsx                  # Dedicated Space Hub dashboard: per-space curriculum docs with active toggles, space renaming, 26 emoji presets & AI pedagogy settings
│   ├── ThreeDView.jsx                    # 3D studio container with 51 interactive scientific simulations across 5 STEM domains, TopicSelectorDropdown & resizable HUD
│   ├── WebSaverView.jsx                  # Dual-pane Website Saver & Folder Manager with drag-and-drop tree & grid/list views
│   ├── Workspace.jsx                     # Central workspace layout, top HUD header, space state & global shortcuts
```
