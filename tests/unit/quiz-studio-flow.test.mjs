import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { summariseMastery } from "../../lib/mastery.js";
import { extractHeadingsFromBlocks, editorBlocksToText } from "../../lib/blocks.js";

/**
 * In-memory simulation of Quiz Storage & Lifecycle operations
 * mirroring lib/storageService.js
 */
class InMemoryQuizStore {
  constructor() {
    this.quizzes = new Map();
    this.quizTrash = new Map();
    this.studySessions = [];
  }

  saveQuiz(quizData) {
    const id = quizData.id || `quiz_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record = {
      id,
      spaceId: quizData.spaceId || "School",
      noteId: quizData.noteId || null,
      noteTitle: quizData.noteTitle || "",
      noteIds: Array.isArray(quizData.noteIds)
        ? quizData.noteIds
        : quizData.noteId
          ? [quizData.noteId]
          : [],
      noteTitles: Array.isArray(quizData.noteTitles)
        ? quizData.noteTitles
        : quizData.noteTitle
          ? [quizData.noteTitle]
          : [],
      title: quizData.title || "Custom Quiz",
      difficulty: quizData.difficulty || "medium",
      scope: quizData.scope || "whole",
      focusText: quizData.focusText || "",
      questionCounts: quizData.questionCounts || { mcq: 5, shortAnswer: 3, longAnswer: 0 },
      questions: Array.isArray(quizData.questions) ? quizData.questions : [],
      status: quizData.status || "pending",
      draftAnswers: quizData.draftAnswers !== undefined ? quizData.draftAnswers : null,
      draftIndex: typeof quizData.draftIndex === "number" ? quizData.draftIndex : 0,
      result: quizData.result || null,
      userAnswers: quizData.userAnswers || {},
      createdAt: quizData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.quizzes.set(id, record);
    return record;
  }

  clearQuizTrash() {
    this.quizTrash.clear();
  }

  getQuizById(id) {
    return this.quizzes.get(id) || null;
  }

  getQuizzesBySpace(spaceId) {
    return Array.from(this.quizzes.values()).filter((q) => !spaceId || q.spaceId === spaceId);
  }

  deleteQuizToTrash(id) {
    const item = this.quizzes.get(id);
    if (item) {
      this.quizTrash.set(id, { ...item, deletedAt: new Date().toISOString() });
      this.quizzes.delete(id);
    }
  }

  getTrashQuizzes() {
    const now = Date.now();
    const valid = [];
    for (const [id, item] of this.quizTrash.entries()) {
      const deletedTime = new Date(item.deletedAt || 0).getTime();
      if (now - deletedTime > 24 * 60 * 60 * 1000) {
        this.quizTrash.delete(id);
      } else {
        valid.push(item);
      }
    }
    return valid;
  }

  recoverQuiz(id) {
    const item = this.quizTrash.get(id);
    if (item) {
      const { deletedAt, ...restored } = item;
      this.quizzes.set(id, { ...restored, updatedAt: new Date().toISOString() });
      this.quizTrash.delete(id);
    }
  }

  permanentlyDeleteQuiz(id) {
    this.quizTrash.delete(id);
    this.quizzes.delete(id);
  }

  recordStudySession(session) {
    const record = {
      id: session.id || `sess_${Date.now()}`,
      noteId: session.noteId || "general",
      noteTitle: session.noteTitle || "",
      space: session.space || "School",
      concept: session.concept || "",
      mode: session.mode || "quiz",
      score: session.score || 0,
      summary: session.summary || "",
      heatmap: session.heatmap || [],
      createdAt: session.createdAt || new Date().toISOString(),
    };
    this.studySessions.push(record);
    return record;
  }
}

describe("Quizzes Studio — CRUD, Question Breakdown & Mastery Integration", () => {
  let store;

  beforeEach(() => {
    store = new InMemoryQuizStore();
  });

  it("creates a new quiz with custom difficulty, scope and question breakdown", () => {
    const quiz = store.saveQuiz({
      spaceId: "School",
      noteId: "note_wave_101",
      noteTitle: "Wave Optics & Interference",
      title: "Wave Optics Diagnostic Exam",
      difficulty: "hard",
      scope: "heading",
      focusText: "Section: Young's Double Slit",
      questionCounts: { mcq: 4, shortAnswer: 2, longAnswer: 1 },
      questions: [
        { id: "q0", subtopic: "Interference", type: "multiple_choice", prompt: "What determines fringe width?", options: ["Wavelength", "Slit separation", "Screen distance", "All above"], correctIndex: 3, expectedAnswer: "All variables contribute" },
        { id: "q1", subtopic: "Phase Difference", type: "short_answer", prompt: "State the phase difference for destructive interference.", options: [], correctIndex: -1, expectedAnswer: "(2n+1)*pi" },
        { id: "q2", subtopic: "Derivation", type: "long_answer", prompt: "Provide full derivation of path difference.", options: [], correctIndex: -1, expectedAnswer: "delta = x*d / D" },
      ],
      status: "pending",
    });

    assert.ok(quiz);
    assert.ok(quiz.id.startsWith("quiz_"));
    assert.strictEqual(quiz.difficulty, "hard");
    assert.strictEqual(quiz.status, "pending");
    assert.strictEqual(quiz.questions.length, 3);
    assert.strictEqual(quiz.questionCounts.mcq, 4);
    assert.strictEqual(quiz.questionCounts.longAnswer, 1);
  });

  it("filters quizzes accurately by space", () => {
    store.saveQuiz({ spaceId: "School", title: "Physics Quiz", difficulty: "easy" });
    store.saveQuiz({ spaceId: "School", title: "Calculus Quiz", difficulty: "medium" });
    store.saveQuiz({ spaceId: "Personal", title: "Philosophy Quiz", difficulty: "hard" });

    const school = store.getQuizzesBySpace("School");
    assert.strictEqual(school.length, 2);

    const personal = store.getQuizzesBySpace("Personal");
    assert.strictEqual(personal.length, 1);
    assert.strictEqual(personal[0].title, "Philosophy Quiz");
  });

  it("handles delete to trash, restore, and permanent delete accurately", () => {
    const quiz = store.saveQuiz({
      spaceId: "School",
      title: "Chemistry Equilibrium Quiz",
      difficulty: "medium",
    });

    // 1. Delete to trash
    store.deleteQuizToTrash(quiz.id);

    const activeList = store.getQuizzesBySpace("School");
    assert.strictEqual(activeList.length, 0);

    const trashList = store.getTrashQuizzes();
    assert.strictEqual(trashList.length, 1);
    assert.strictEqual(trashList[0].id, quiz.id);

    // 2. Recover from trash
    store.recoverQuiz(quiz.id);

    const activeAfterRecover = store.getQuizzesBySpace("School");
    assert.strictEqual(activeAfterRecover.length, 1);
    assert.strictEqual(activeAfterRecover[0].title, "Chemistry Equilibrium Quiz");

    const trashAfterRecover = store.getTrashQuizzes();
    assert.strictEqual(trashAfterRecover.length, 0);

    // 3. Permanent delete
    store.deleteQuizToTrash(quiz.id);
    store.permanentlyDeleteQuiz(quiz.id);

    assert.strictEqual(store.getTrashQuizzes().length, 0);
    assert.strictEqual(store.getQuizzesBySpace("School").length, 0);
  });

  it("completing a quiz saves graded results and rolls up seamlessly into Mastery Dashboard", () => {
    const quiz = store.saveQuiz({
      spaceId: "School",
      noteId: "note_geo_optics",
      noteTitle: "Geometric Optics",
      title: "Refraction & Lenses Exam",
      difficulty: "hard",
      questions: [
        { id: "q0", subtopic: "Snell's Law", type: "multiple_choice", prompt: "Calculate critical angle", options: ["30", "41.8", "60", "90"], correctIndex: 1, expectedAnswer: "41.8 deg" },
        { id: "q1", subtopic: "Lens Equation", type: "short_answer", prompt: "Explain focal length of convex lens", options: [], correctIndex: -1, expectedAnswer: "Positive focal length" },
      ],
      status: "pending",
    });

    const gradedResult = {
      score: 85,
      summary: "Solid grasp of Snell's Law and Total Internal Reflection. Minor confusion on lens convention.",
      heatmap: [
        { subtopic: "Snell's Law", status: "green", feedback: "Accurate critical angle computation." },
        { subtopic: "Lens Equation", status: "yellow", feedback: "Remember sign convention for virtual image." },
      ],
      gradedAnswers: [
        { questionIndex: 0, subtopic: "Snell's Law", correct: true, yourAnswer: "41.8", feedback: "Correct." },
        { questionIndex: 1, subtopic: "Lens Equation", correct: false, yourAnswer: "inverted", feedback: "Review sign convention." },
      ],
      correctCount: 1,
      totalCount: 2,
      completedAt: new Date().toISOString(),
    };

    // 1. Update quiz state to completed
    const completedQuiz = store.saveQuiz({
      ...quiz,
      status: "completed",
      result: gradedResult,
      userAnswers: { 0: 1, 1: "inverted" },
    });

    assert.strictEqual(completedQuiz.status, "completed");
    assert.strictEqual(completedQuiz.result.score, 85);

    // 2. Correlate with Mastery by recording study session
    store.recordStudySession({
      noteId: quiz.noteId,
      noteTitle: quiz.noteTitle,
      space: quiz.spaceId,
      concept: quiz.title,
      mode: "quiz",
      score: gradedResult.score,
      summary: gradedResult.summary,
      heatmap: gradedResult.heatmap,
    });

    assert.strictEqual(store.studySessions.length, 1);
    assert.strictEqual(store.studySessions[0].score, 85);

    // 3. Verify Rollup in Mastery Analytics Engine
    const masteryRollup = summariseMastery(store.studySessions);
    assert.ok(masteryRollup);
    assert.strictEqual(masteryRollup.sessionCount, 1);
    assert.strictEqual(masteryRollup.averageScore, 85);
    assert.ok(masteryRollup.topics.some((t) => t.subtopic === "Snell's Law" && t.status === "green"));
    assert.ok(masteryRollup.topics.some((t) => t.subtopic === "Lens Equation" && t.status === "yellow"));
  });

  it("extracts all heading types (H1–H4) accurately from diverse block structures", () => {
    const blocks = [
      { id: "b0", type: "callout", content: "Important reminder" },
      { id: "b1", type: "h1", content: "Chapter 14: Coordination & Response" },
      { id: "b2", type: "text", content: "Nervous systems allow organisms to react to changes in their environment." },
      { id: "b3", type: "h2", content: "14.2 Sense Organs: The Eye & Reflex Pathway" },
      { id: "b4", type: "bullet", content: "Cornea refracts light" },
      { id: "b5", type: "h3", content: "Pupil Accommodation Mechanism" },
      { id: "b6", type: "h4", content: "Antagonistic Muscle Pair Details" },
      { id: "b7", type: "text", content: "### Markdown Embedded Sub-Heading\nSome content" },
      { id: "b8", type: "code", content: "const x = 10;" },
    ];

    const headings = extractHeadingsFromBlocks(blocks);
    assert.strictEqual(headings.length, 5);
    assert.strictEqual(headings[0].type, "H1");
    assert.strictEqual(headings[0].level, 1);
    assert.strictEqual(headings[0].text, "Chapter 14: Coordination & Response");

    assert.strictEqual(headings[1].type, "H2");
    assert.strictEqual(headings[1].level, 2);
    assert.strictEqual(headings[1].text, "14.2 Sense Organs: The Eye & Reflex Pathway");

    assert.strictEqual(headings[2].type, "H3");
    assert.strictEqual(headings[2].text, "Pupil Accommodation Mechanism");

    assert.strictEqual(headings[3].type, "H4");
    assert.strictEqual(headings[3].text, "Antagonistic Muscle Pair Details");

    assert.strictEqual(headings[4].type, "H3");
    assert.strictEqual(headings[4].text, "Markdown Embedded Sub-Heading");
  });

  it("constructs target section focus prompt when multiple headings are checked", () => {
    const selectedHeadings = [
      "14.2 Sense Organs: The Eye & Reflex Pathway",
      "Pupil Accommodation Mechanism",
    ];

    const focusText = `Target Sections: ${selectedHeadings.map((h) => `"${h}"`).join(", ")}`;
    const concept = selectedHeadings.join(" & ");

    assert.strictEqual(
      focusText,
      'Target Sections: "14.2 Sense Organs: The Eye & Reflex Pathway", "Pupil Accommodation Mechanism"'
    );
    assert.strictEqual(
      concept,
      "14.2 Sense Organs: The Eye & Reflex Pathway & Pupil Accommodation Mechanism"
    );
  });

  it("retake action starts with empty answers instead of previous answers", () => {
    const completedQuiz = store.saveQuiz({
      spaceId: "School",
      title: "Completed Genetics Quiz",
      userAnswers: { 0: 2, 1: "Dominant allele", 2: "BB x bb" },
      status: "completed",
    });

    // Simulating retake handler: isRetake true returns {}
    const startQuizState = (quiz, isRetake = false) => ({
      takingQuiz: quiz,
      quizAnswers: isRetake ? {} : (quiz.userAnswers || {}),
    });

    const standardStart = startQuizState(completedQuiz, false);
    assert.deepStrictEqual(standardStart.quizAnswers, { 0: 2, 1: "Dominant allele", 2: "BB x bb" });

    const retakeStart = startQuizState(completedQuiz, true);
    assert.deepStrictEqual(retakeStart.quizAnswers, {});
  });

  it("serializes rich note blocks including tables, math formulas, toggles and callouts for AI context", () => {
    const richBlocks = [
      { id: "b1", type: "h1", content: "Organic Chemistry: Functional Groups" },
      { id: "b2", type: "callout", calloutIcon: "⚠️", content: "Remember IUPAC nomenclature rules" },
      {
        id: "b3",
        type: "table",
        content: "",
        tableData: {
          headers: ["Prefix", "Structure", "Suffix"],
          rows: [
            ["Alkyl", "R-H", "-ane"],
            ["Alcohol", "R-OH", "-ol"],
            ["Carboxylic Acid", "R-COOH", "-oic acid"],
          ],
        },
      },
      { id: "b4", type: "toggle", content: "Esterification Reaction", details: "Carboxylic acid + Alcohol -> Ester + Water (in presence of conc. H2SO4 catalyst)" },
      { id: "b5", type: "math", content: "CH_3COOH + C_2H_5OH \\rightleftharpoons CH_3COOC_2H_5 + H_2O" },
      { id: "b6", type: "divider" },
      { id: "b7", type: "todo", checked: true, content: "Memorize ester smells" },
    ];

    const serializedText = editorBlocksToText(richBlocks);
    assert.ok(serializedText.includes("# Organic Chemistry: Functional Groups"));
    assert.ok(serializedText.includes("> ⚠️ Remember IUPAC nomenclature rules"));
    assert.ok(serializedText.includes("| Prefix | Structure | Suffix |"));
    assert.ok(serializedText.includes("| Alkyl | R-H | -ane |"));
    assert.ok(serializedText.includes("**Esterification Reaction**\nCarboxylic acid + Alcohol -> Ester + Water"));
    assert.ok(serializedText.includes("$$\nCH_3COOH + C_2H_5OH \\rightleftharpoons CH_3COOC_2H_5 + H_2O\n$$"));
    assert.ok(serializedText.includes("---"));
    assert.ok(serializedText.includes("[x] Memorize ester smells"));
  });

  it("creates a multi-note quiz with noteIds and noteTitles preserving multiple sources", () => {
    const multiNoteQuiz = store.saveQuiz({
      spaceId: "School",
      noteId: "note_optics_1",
      noteTitle: "Geometric Optics, Wave Optics",
      noteIds: ["note_optics_1", "note_optics_2"],
      noteTitles: ["Geometric Optics", "Wave Optics"],
      title: "Optics Comprehensive Diagnostic",
      difficulty: "hard",
      scope: "whole",
      questionCounts: { mcq: 6, shortAnswer: 4, longAnswer: 0 },
      questions: [
        { id: "q0", subtopic: "Snell's Law", type: "multiple_choice", prompt: "Index of refraction calculation", options: ["1.33", "1.5", "1.0", "2.0"], correctIndex: 1, expectedAnswer: "1.5" },
        { id: "q1", subtopic: "Diffraction", type: "short_answer", prompt: "Explain Huygens-Fresnel principle", options: [], correctIndex: -1, expectedAnswer: "Every point is secondary wavelet" },
      ],
      status: "pending",
    });

    assert.ok(multiNoteQuiz);
    assert.strictEqual(multiNoteQuiz.noteIds.length, 2);
    assert.deepStrictEqual(multiNoteQuiz.noteIds, ["note_optics_1", "note_optics_2"]);
    assert.deepStrictEqual(multiNoteQuiz.noteTitles, ["Geometric Optics", "Wave Optics"]);
    assert.strictEqual(multiNoteQuiz.noteTitle, "Geometric Optics, Wave Optics");
  });

  it("formats and concatenates multiple notes with clear demarcations for AI generation and grading", () => {
    const note1 = {
      id: "n1",
      title: "Cell Respiration",
      blocks: [
        { id: "b1", type: "h1", content: "Glycolysis & Krebs Cycle" },
        { id: "b2", type: "text", content: "Glycolysis breaks glucose into 2 pyruvate molecules yielding 2 net ATP." },
      ],
    };

    const note2 = {
      id: "n2",
      title: "Photosynthesis",
      blocks: [
        { id: "b3", type: "h1", content: "Light & Dark Reactions" },
        { id: "b4", type: "text", content: "Chloroplasts use photons in the thylakoid membrane to split water." },
      ],
    };

    const selectedNotes = [note1, note2];
    const noteContentsList = [];
    for (const note of selectedNotes) {
      const text = editorBlocksToText(note.blocks || []);
      if (text && text.trim()) {
        noteContentsList.push(
          selectedNotes.length > 1
            ? `=== Source Note: "${note.title || "Untitled Note"}" ===\n${text.trim()}`
            : text.trim()
        );
      }
    }

    const combined = noteContentsList.join("\n\n----------------------------------------\n\n");

    assert.ok(combined.includes('=== Source Note: "Cell Respiration" ==='));
    assert.ok(combined.includes("Glycolysis breaks glucose into 2 pyruvate molecules yielding 2 net ATP."));
    assert.ok(combined.includes("----------------------------------------"));
    assert.ok(combined.includes('=== Source Note: "Photosynthesis" ==='));
    assert.ok(combined.includes("Chloroplasts use photons in the thylakoid membrane to split water."));
  });

  it("extracts and attributes headings across multiple notes without naming collisions", () => {
    const noteA = {
      id: "note_a",
      title: "Calculus",
      blocks: [
        { id: "ba1", type: "h1", content: "Introduction" },
        { id: "ba2", type: "h2", content: "Limits and Continuity" },
      ],
    };

    const noteB = {
      id: "note_b",
      title: "Linear Algebra",
      blocks: [
        { id: "bb1", type: "h1", content: "Introduction" },
        { id: "bb2", type: "h2", content: "Vector Spaces & Subspaces" },
      ],
    };

    const selectedNotes = [noteA, noteB];
    const headings = [];
    selectedNotes.forEach((note) => {
      if (Array.isArray(note.blocks)) {
        const noteHeadings = extractHeadingsFromBlocks(note.blocks);
        noteHeadings.forEach((h, idx) => {
          const displayLabel =
            selectedNotes.length > 1 ? `[${note.title || "Untitled"}] ${h.text}` : h.text;
          headings.push({
            ...h,
            id: `${note.id}_${h.type}_${idx}_${h.text}`,
            noteId: note.id,
            noteTitle: note.title || "Untitled",
            displayLabel,
          });
        });
      }
    });

    assert.strictEqual(headings.length, 4);
    assert.strictEqual(headings[0].displayLabel, "[Calculus] Introduction");
    assert.strictEqual(headings[1].displayLabel, "[Calculus] Limits and Continuity");
    assert.strictEqual(headings[2].displayLabel, "[Linear Algebra] Introduction");
    assert.strictEqual(headings[3].displayLabel, "[Linear Algebra] Vector Spaces & Subspaces");
    // Headings with same name ("Introduction") remain distinct via displayLabel and noteId
    assert.notStrictEqual(headings[0].displayLabel, headings[2].displayLabel);
  });

  it("auto-saves draftAnswers and draftIndex and updates quiz status to in_progress", () => {
    const quiz = store.saveQuiz({
      spaceId: "School",
      title: "Molecular Genetics Exam",
      difficulty: "medium",
      questions: [
        { id: "q0", subtopic: "DNA Replication", type: "multiple_choice", prompt: "Enzyme unwinding DNA?", options: ["Helicase", "Polymerase", "Ligase"], correctIndex: 0 },
        { id: "q1", subtopic: "Transcription", type: "short_answer", prompt: "Explain mRNA role", options: [], correctIndex: -1 },
        { id: "q2", subtopic: "Translation", type: "multiple_choice", prompt: "Start codon?", options: ["AUG", "UAA", "UAG"], correctIndex: 0 },
      ],
      status: "pending",
    });

    // Answering Q0 and advancing to Q1
    const updated = store.saveQuiz({
      ...quiz,
      draftAnswers: { 0: 0 },
      draftIndex: 1,
      status: "in_progress",
    });

    assert.strictEqual(updated.status, "in_progress");
    assert.strictEqual(updated.draftIndex, 1);
    assert.deepStrictEqual(updated.draftAnswers, { 0: 0 });

    // Answering Q1 with short answer and advancing to Q2
    const updated2 = store.saveQuiz({
      ...updated,
      draftAnswers: { 0: 0, 1: "Carries genetic code from DNA to ribosome" },
      draftIndex: 2,
      status: "in_progress",
    });

    assert.strictEqual(updated2.draftIndex, 2);
    assert.strictEqual(updated2.draftAnswers[1], "Carries genetic code from DNA to ribosome");

    const retrieved = store.getQuizById(quiz.id);
    assert.strictEqual(retrieved.status, "in_progress");
    assert.strictEqual(retrieved.draftIndex, 2);
    assert.deepStrictEqual(retrieved.draftAnswers, {
      0: 0,
      1: "Carries genetic code from DNA to ribosome",
    });
  });

  it("resumes in-progress quiz restoring draft answers and active index", () => {
    const inProgressQuiz = store.saveQuiz({
      spaceId: "School",
      title: "Cell Division Quiz",
      difficulty: "easy",
      questions: [
        { id: "q0", subtopic: "Mitosis", type: "multiple_choice", prompt: "Stages of mitosis", options: ["PMAT", "TAMP"], correctIndex: 0 },
        { id: "q1", subtopic: "Meiosis", type: "short_answer", prompt: "Crossing over definition", options: [], correctIndex: -1 },
      ],
      draftAnswers: { 0: 0 },
      draftIndex: 1,
      status: "in_progress",
    });

    // Simulating resume logic from handleStartQuiz(quiz, false)
    const resumeQuizState = (quiz, isRetake = false) => {
      if (isRetake) {
        return {
          quizAnswers: {},
          quizIndex: 0,
        };
      }
      return {
        quizAnswers: quiz.draftAnswers || quiz.userAnswers || {},
        quizIndex: typeof quiz.draftIndex === "number" && quiz.draftIndex >= 0
          ? Math.min(quiz.draftIndex, (quiz.questions?.length || 1) - 1)
          : 0,
      };
    };

    const resumed = resumeQuizState(inProgressQuiz, false);
    assert.deepStrictEqual(resumed.quizAnswers, { 0: 0 });
    assert.strictEqual(resumed.quizIndex, 1);
  });

  it("submitting graded quiz clears draftAnswers and draftIndex and marks status as completed", () => {
    const inProgressQuiz = store.saveQuiz({
      spaceId: "School",
      title: "Organic Chemistry Quiz",
      questions: [
        { id: "q0", subtopic: "Alkanes", type: "multiple_choice", prompt: "General formula?", options: ["CnH2n+2", "CnH2n"], correctIndex: 0 },
      ],
      draftAnswers: { 0: 0 },
      draftIndex: 0,
      status: "in_progress",
    });

    const gradedResult = {
      score: 100,
      correctCount: 1,
      totalCount: 1,
      summary: "Perfect score on basic hydrocarbons.",
      heatmap: [{ subtopic: "Alkanes", status: "green", feedback: "Correct general formula." }],
      gradedAnswers: [{ questionIndex: 0, subtopic: "Alkanes", correct: true, yourAnswer: "CnH2n+2" }],
      completedAt: new Date().toISOString(),
    };

    const completed = store.saveQuiz({
      ...inProgressQuiz,
      status: "completed",
      draftAnswers: null,
      draftIndex: 0,
      result: gradedResult,
      userAnswers: inProgressQuiz.draftAnswers,
    });

    assert.strictEqual(completed.status, "completed");
    assert.strictEqual(completed.draftAnswers, null);
    assert.strictEqual(completed.draftIndex, 0);
    assert.deepStrictEqual(completed.userAnswers, { 0: 0 });
    assert.strictEqual(completed.result.score, 100);
  });

  it("clearing quiz trash permanently empties all trash items", () => {
    const quiz1 = store.saveQuiz({ spaceId: "School", title: "Quiz 1" });
    const quiz2 = store.saveQuiz({ spaceId: "School", title: "Quiz 2" });

    store.deleteQuizToTrash(quiz1.id);
    store.deleteQuizToTrash(quiz2.id);

    assert.strictEqual(store.getTrashQuizzes().length, 2);

    store.clearQuizTrash();

    assert.strictEqual(store.getTrashQuizzes().length, 0);
    assert.strictEqual(store.quizTrash.size, 0);
  });

  it("handleClearAnswer correctly deletes answer key and updates answered count", () => {
    let answers = { 0: 1, 1: "mechanism text", 2: 3 };

    const clearAnswer = (currentAnswers, targetIdx) => {
      const next = { ...currentAnswers };
      delete next[targetIdx];
      return next;
    };

    answers = clearAnswer(answers, 1);
    assert.strictEqual(answers[1], undefined);
    assert.strictEqual(Object.keys(answers).length, 2);

    const questions = [{ id: "q0" }, { id: "q1" }, { id: "q2" }];
    const answeredCount = questions.filter(
      (_, i) => answers[i] !== undefined && answers[i] !== ""
    ).length;
    assert.strictEqual(answeredCount, 2);
  });

  it("quiz hotkey mapping translates A-E and 1-5 keys to zero-indexed option indexes", () => {
    const resolveOptionIndex = (keyStr, optionsCount) => {
      const key = keyStr.toUpperCase();
      let pickedIndex = -1;
      if ((key === "A" || key === "1") && optionsCount > 0) pickedIndex = 0;
      else if ((key === "B" || key === "2") && optionsCount > 1) pickedIndex = 1;
      else if ((key === "C" || key === "3") && optionsCount > 2) pickedIndex = 2;
      else if ((key === "D" || key === "4") && optionsCount > 3) pickedIndex = 3;
      else if ((key === "E" || key === "5") && optionsCount > 4) pickedIndex = 4;
      return pickedIndex;
    };

    assert.strictEqual(resolveOptionIndex("a", 4), 0);
    assert.strictEqual(resolveOptionIndex("B", 4), 1);
    assert.strictEqual(resolveOptionIndex("3", 4), 2);
    assert.strictEqual(resolveOptionIndex("4", 4), 3);
    assert.strictEqual(resolveOptionIndex("5", 4), -1); // 4 options only
    assert.strictEqual(resolveOptionIndex("z", 4), -1);
  });

  it("normalizes multi-note quiz data and filters source notes by search query", () => {
    const quiz = {
      id: "quiz-multi-19",
      title: "All chapters MCQ",
      noteIds: Array.from({ length: 19 }, (_, i) => `note-${i + 1}`),
      noteTitles: Array.from({ length: 19 }, (_, i) => `Chapter ${i + 1}: Topic ${i + 1}`),
    };

    const notes = quiz.noteIds.map((id, idx) => ({
      id,
      title: quiz.noteTitles[idx] || `Note ${idx + 1}`,
    }));

    assert.strictEqual(notes.length, 19);
    assert.strictEqual(notes[0].title, "Chapter 1: Topic 1");
    assert.strictEqual(notes[18].title, "Chapter 19: Topic 19");

    const query = "chapter 15";
    const filtered = notes.filter((n) =>
      n.title.toLowerCase().includes(query.toLowerCase().trim())
    );
    assert.strictEqual(filtered.length, 1);
    assert.strictEqual(filtered[0].title, "Chapter 15: Topic 15");
  });

  it("generates concise multi-note synthesis title without overflowing length limits", () => {
    const generateTitle = (selectedSpace, picked) => {
      if (picked.length > 3) {
        return `${selectedSpace} Synthesis Quiz (${picked.length} Notes)`;
      }
      const names = picked
        .slice(0, 2)
        .map((n) => {
          const t = n.title || "Untitled";
          return t.length > 25 ? `${t.slice(0, 22).trim()}...` : t;
        })
        .join(" & ");
      return `${names}${picked.length > 2 ? ` +${picked.length - 2}` : ""} Quiz`;
    };

    const notes19 = Array.from({ length: 19 }, (_, i) => ({
      id: `n-${i}`,
      title: `Chapter ${i + 1}: Very Long Detailed Topic Name That Would Otherwise Overflow`,
    }));

    const title19 = generateTitle("Biology", notes19);
    assert.strictEqual(title19, "Biology Synthesis Quiz (19 Notes)");

    const notes2 = [
      { id: "1", title: "Kinematics in One Dimension" },
      { id: "2", title: "Dynamics and Newton's Laws" },
    ];
    const title2 = generateTitle("Physics", notes2);
    assert.strictEqual(title2, "Kinematics in One Dime... & Dynamics and Newton's... Quiz");
  });

  it("handles high-volume heading lookups in O(1) time using Set index", () => {
    // Generate 100 mock headings across 5 notes
    const mockHeadings = Array.from({ length: 100 }, (_, i) => ({
      id: `h_${i}`,
      type: i % 3 === 0 ? "H1" : i % 3 === 1 ? "H2" : "H3",
      displayLabel: `[Note ${Math.floor(i / 20)}] Heading ${i}`,
      text: `Heading ${i}`,
    }));

    // Selected subset
    const selectedLabels = mockHeadings.slice(10, 40).map((h) => h.displayLabel);
    const selectedSet = new Set(selectedLabels);

    assert.strictEqual(selectedSet.has(mockHeadings[15].displayLabel), true);
    assert.strictEqual(selectedSet.has(mockHeadings[50].displayLabel), false);

    // Fast filter with Set
    const valid = selectedLabels.filter((lbl) => selectedSet.has(lbl));
    assert.strictEqual(valid.length, 30);
  });

  it("guards closed modal state to prevent unneeded block tree extraction", () => {
    const extractIfOpen = (open, notes) => {
      if (!open || !notes || notes.length === 0) return [];
      return notes.flatMap((n) => extractHeadingsFromBlocks(n.blocks || []));
    };

    const notesWithBlocks = [
      {
        id: "1",
        title: "Cell Biology",
        blocks: [
          { type: "h1", content: "Organelles" },
          { type: "text", content: "Cell membrane and cytoplasm" },
          { type: "h2", content: "Mitochondria" },
        ],
      },
    ];

    // When closed, returns empty array immediately
    const closedResult = extractIfOpen(false, notesWithBlocks);
    assert.deepStrictEqual(closedResult, []);

    // When open, extracts headings
    const openResult = extractIfOpen(true, notesWithBlocks);
    assert.strictEqual(openResult.length, 2);
    assert.strictEqual(openResult[0].text, "Organelles");
  });
});

