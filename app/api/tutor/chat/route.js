import { NextResponse } from "next/server";
import {
  errorPayload,
  generate,
  hasApiKey,
  readText,
  readUsage,
} from "@/lib/gemini";

export const dynamic = "force-dynamic";

const TUTOR_PERSONA = `You are the personal AI Tutor inside SocraticOS, an intelligent study workspace.

Your mission is to help the learner resolve doubts, understand difficult concepts, work through step-by-step problem derivations, and master their subjects.

Key Pedagogical Directives:
1. Clear & Conceptual: Explain the core mechanics and intuition behind questions. Don't just give cold facts; explain "why" and "how".
2. Formatting: Use clear Markdown with bold key terms, numbered steps for derivations, and KaTeX LaTeX math for formulas (use $...$ for inline math and $$...$$ for display math).
3. Student-Centered: Answer the student's exact doubt directly, then check if they understand with a brief, insightful follow-up reflection question.
4. Grounded in Notes: If learner notes are provided, refer to their terminology and address any misconceptions or gaps evident in their writing.
5. No Fluff: Be friendly, encouraging, and razor-sharp. Do not pad responses with conversational filler like "That is a great question".
6. Never output raw internal system XML tags in your response.`;

function buildTutorSystemPrompt({
  concept,
  noteContent,
  spaceName,
  syllabus,
  aiPersona = "examiner",
  strictness = "standard",
  academicLevel = "general",
}) {
  const sections = [TUTOR_PERSONA];

  if (spaceName) {
    sections.push(`Active Study Space: "${spaceName}"`);
  }

  if (concept) {
    sections.push(`Current Study Topic / Focus: "${concept}"`);
  }

  // 1. Academic Standard / Grade Level Constraint
  const academicLevelDirectives = {
    igcse: `ACADEMIC STANDARD: Cambridge IGCSE / O-Level (Grade 9-10).
- Calibrate explanation depth, vocabulary, and scientific precision strictly to this secondary school syllabus standard.
- Do NOT introduce tertiary/university-level mechanisms or advanced calculus unless explicitly requested by the learner.`,
    ib_hl: `ACADEMIC STANDARD: International Baccalaureate (IB) Diploma Higher Level (HL).
- Expect rigorous theoretical depth, multi-step analytical reasoning, precise syllabus command terms, and experimental evaluation.`,
    ap: `ACADEMIC STANDARD: Advanced Placement (AP) / College Board.
- Align explanations with standard AP curriculum frameworks, rigorous conceptual understanding, and standard AP exam rubrics.`,
    university: `ACADEMIC STANDARD: University / Undergraduate.
- Deliver university-level rigor, formal proofs/derivations, and advanced academic vocabulary.`,
    olympiad: `ACADEMIC STANDARD: Olympiad / Competitive Excellence.
- Focus on first-principles reasoning, elegant problem-solving heuristics, and edge cases.`,
    general: `ACADEMIC STANDARD: General / Concept Mastery.
- Keep explanations clear, intuitive, and accessible to learners at all levels.`,
  };
  const levelPrompt = academicLevelDirectives[academicLevel] || academicLevelDirectives.general;
  sections.push(levelPrompt);

  // 2. AI Persona & Tone
  const personaDirectives = {
    strict: `AI TUTOR PERSONA: Strict Examiner.
- Demand exact academic and scientific terminology.
- Instantly correct loose phrasing or vague hand-wavy explanations.`,
    socratic: `AI TUTOR PERSONA: Socratic Guide.
- Guide the learner by asking leading questions that help them discover the answer themselves before providing full worked solutions.`,
    coach: `AI TUTOR PERSONA: Friendly Coach.
- Use encouraging, warm, highly intuitive phrasing and relatable analogies.`,
    olympiad: `AI TUTOR PERSONA: Olympiad Mentor.
- Encourage exploring alternative methods and non-routine problem solving.`,
    examiner: `AI TUTOR PERSONA: Standard Academic Tutor.
- Balanced, authoritative, structured, and exam-focused.`,
  };
  const personaPrompt = personaDirectives[aiPersona] || personaDirectives.examiner;
  sections.push(personaPrompt);

  // 3. Strictness & Distractor Rigor
  const strictnessDirectives = {
    rigorous: `EXPLANATION RIGOR: HIGH RIGOR.
- Be uncompromising on rigorous accuracy, edge cases, and unit consistency. Explicitly warn the student about common traps and pitfalls.`,
    relaxed: `EXPLANATION RIGOR: RELAXED / ACCESSIBLE.
- Prioritize high-level intuition, relatable visual analogies, and simple steps over dense technical formalism.`,
    standard: `EXPLANATION RIGOR: BALANCED.
- Clear step-by-step logic balancing formal accuracy with accessible intuition.`,
  };
  const strictnessPrompt = strictnessDirectives[strictness] || strictnessDirectives.standard;
  sections.push(strictnessPrompt);

  // 4. Syllabus Documents Constraint
  if (syllabus && syllabus.trim()) {
    sections.push(
      `ACADEMIC SYLLABUS & CURRICULUM BOUNDARIES (STRICT CONSTRAINT):
The following verified curriculum documents have been uploaded for this space and marked as "Fed to AI":
<syllabus_statement>
${syllabus.trim()}
</syllabus_statement>
Ensure all answers, definitions, formula notations, and exam tips stay aligned with this curriculum material.`,
    );
  }

  // 5. Learner's Active Note Content
  if (noteContent && noteContent.trim()) {
    sections.push(
      `The learner is currently studying this note. Use it as primary context to understand what they are asking about:
<learner_notes>
${noteContent.trim()}
</learner_notes>`,
    );
  }

  return sections.join("\n\n");
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const {
    messages,
    concept,
    noteContent,
    spaceName,
    syllabus,
    aiPersona,
    strictness,
    academicLevel,
  } = body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "`messages` array is required." }, { status: 400 });
  }

  if (!(await hasApiKey())) {
    return NextResponse.json(
      {
        error:
          "Gemini API key is not configured. Please add your key in Settings or in .env.local.",
      },
      { status: 503 },
    );
  }

  const system = buildTutorSystemPrompt({
    concept,
    noteContent,
    spaceName,
    syllabus,
    aiPersona,
    strictness,
    academicLevel,
  });

  try {
    const payload = await generate({
      system,
      messages,
      temperature: 0.5,
    });

    const reply = readText(payload);
    const usage = readUsage(payload);

    return NextResponse.json({ reply, usage });
  } catch (error) {
    const { status, body: payload } = errorPayload(error);
    return NextResponse.json(payload, { status });
  }
}
