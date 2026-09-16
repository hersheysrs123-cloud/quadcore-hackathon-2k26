// ─── Bacteria, viruses and antibiotics ──────────────────────────────
// The model behind the side-by-side comparison scene, built around one
// question: why does penicillin cure a bacterial infection and do
// nothing at all for a viral one?
//
// The answer is anatomy. A bacterium is a CELL — a peptidoglycan wall,
// a membrane, cytoplasm with 70S ribosomes, a circular chromosome and
// plasmids, its own metabolism, and it divides on its own. Every
// antibiotic hits one of those parts: penicillin stops the wall's
// cross-links forming, so the wall shreds and the cell bursts under its
// own osmotic pressure; tetracycline jams the 70S ribosome. A virus has
// none of them. A bacteriophage is a protein capsid round a length of
// DNA with a syringe on the end — no wall, no ribosomes, no metabolism.
// It cannot reproduce until it has hijacked a cell, which it does in the
// LYTIC CYCLE: attach, inject the genome, take over the host's
// ribosomes, assemble ~150 new virions, and burst the cell to let them
// out. There is nothing in that for an antibiotic to bind to, which is
// why the efficacy meter reads 100 % for the bacterium and 0 % for the
// virus, and why "is it alive?" is the question that decides the drug.
//
// Two timelines (`lib/timeline.js`): the phage's lytic cycle, and the
// antibiotic's attack on the wall. Both are pure functions of time.
// ─────────────────────────────────────────────────────────────────────

import { makeTimeline, describeTimeline, stageProgress, stageDone, smoothstep, clamp } from "./timeline.js";

// ─── Anatomy ────────────────────────────────────────────────────────

export const BACTERIUM = {
  name: "Bacterium",
  example: "a rod-shaped bacillus (e.g. E. coli)",
  lengthUm: 2,
  widthUm: 0.8,
  parts: [
    { key: "wall", label: "Peptidoglycan cell wall", note: "Cross-linked sugar–peptide mesh; holds the cell's shape against its osmotic pressure" },
    { key: "membrane", label: "Cell membrane", note: "Phospholipid bilayer inside the wall" },
    { key: "nucleoid", label: "Circular chromosome (nucleoid)", note: "One loop of DNA, free in the cytoplasm — no nucleus" },
    { key: "plasmid", label: "Plasmid", note: "Small extra DNA ring; often carries antibiotic-resistance genes" },
    { key: "ribosomes", label: "70S ribosomes", note: "Thousands of them, making the cell's proteins" },
    { key: "flagellum", label: "Flagellum", note: "Rotating protein motor for swimming" },
    { key: "cytoplasm", label: "Cytoplasm", note: "Where metabolism happens — the cell respires, grows and divides" },
  ],
};

export const PHAGE = {
  name: "T4 bacteriophage",
  example: "a virus that infects E. coli",
  headNm: 90,
  lengthNm: 200,
  parts: [
    { key: "capsid", label: "Icosahedral capsid head", note: "A protein shell — not a cell, no membrane" },
    { key: "genome", label: "DNA core", note: "One double-stranded DNA molecule packed inside the head" },
    { key: "sheath", label: "Contractile tail sheath", note: "Springs down like a syringe to drive the core through the wall" },
    { key: "baseplate", label: "Baseplate", note: "Docks on the host wall and triggers contraction" },
    { key: "fibres", label: "Tail fibres", note: "Recognise receptor molecules on one kind of bacterium only" },
  ],
};

/** Roughly how many times longer the bacterium is than the phage. */
export const SIZE_RATIO = Math.round((BACTERIUM.lengthUm * 1000) / PHAGE.lengthNm);

// ─── Living or not ──────────────────────────────────────────────────

export const LIVING_CRITERIA = [
  { key: "cells", label: "Made of one or more cells", bacterium: true, virus: false },
  { key: "metabolism", label: "Has its own metabolism — respires, makes ATP", bacterium: true, virus: false },
  { key: "ribosomes", label: "Has ribosomes to make its own proteins", bacterium: true, virus: false },
  { key: "reproduces", label: "Reproduces on its own (binary fission)", bacterium: true, virus: false },
  { key: "grows", label: "Grows", bacterium: true, virus: false },
  { key: "responds", label: "Responds to its surroundings", bacterium: true, virus: false },
  { key: "genes", label: "Carries genetic material", bacterium: true, virus: true },
  { key: "evolves", label: "Its populations evolve", bacterium: true, virus: true },
];

/** How many of the criteria an organism meets, and the verdict. */
export function classify(kind) {
  const met = LIVING_CRITERIA.filter((c) => c[kind]).length;
  const total = LIVING_CRITERIA.length;
  const living = kind === "bacterium";
  return {
    kind,
    met,
    total,
    living,
    verdict: living ? "living — a cell" : "non-living — a particle that needs a cell",
    checklist: LIVING_CRITERIA.map((c) => ({ key: c.key, label: c.label, met: Boolean(c[kind]) })),
  };
}

// ─── Antibiotics ────────────────────────────────────────────────────

export const ANTIBIOTIC_TARGETS = [
  { key: "wall", drug: "Penicillin", target: "peptidoglycan cell wall", how: "blocks the enzyme that cross-links the wall; the cell bursts under its own pressure" },
  { key: "ribosome", drug: "Tetracycline", target: "70S ribosome", how: "jams the ribosome so no bacterial protein is made" },
  { key: "gyrase", drug: "Ciprofloxacin", target: "DNA gyrase", how: "stops the bacterium copying its chromosome" },
];

/** Is the target there to be hit? Every antibiotic target is a part of a cell. */
export const hasTarget = (kind) => kind === "bacterium";

/** Percentage efficacy of an antibiotic against each kind, with the reason. */
export function antibioticEfficacy(kind, targetKey = "wall") {
  const target = ANTIBIOTIC_TARGETS.find((t) => t.key === targetKey) ?? ANTIBIOTIC_TARGETS[0];
  const present = hasTarget(kind);
  return {
    kind,
    drug: target.drug,
    target: target.target,
    percent: present ? 100 : 0,
    reason: present ? `${target.drug} ${target.how}` : `a virus has no ${target.target} — there is nothing for ${target.drug.toLowerCase()} to bind to`,
  };
}

// ─── The lytic cycle ────────────────────────────────────────────────

/** New phages made per infected cell — T4 manages 100–300. */
export const BURST_SIZE = 150;

export const LYTIC_STAGES = [
  { key: "attachment", label: "Attachment — tail fibres bind receptors on the wall", duration: 2.0 },
  { key: "injection", label: "Genome injection — the sheath contracts and DNA enters", duration: 2.0 },
  { key: "takeover", label: "Host takeover — host DNA is degraded, phage genes run the ribosomes", duration: 3.0 },
  { key: "assembly", label: "Virion assembly — heads, tails and fibres built and packed", duration: 4.0 },
  { key: "lysis", label: "Cell lysis — lysozyme breaks the wall, progeny escape", duration: 1.5 },
];

export const LYTIC_TIMELINE = makeTimeline(LYTIC_STAGES);

/** Virions built by `assemblyProgress` (0–1): slow start, then a rush. */
export function virionsAssembled(assemblyProgress) {
  const k = clamp(assemblyProgress, 0, 1);
  return Math.round(BURST_SIZE * k * k);
}

export function describeInfection(t) {
  const tl = LYTIC_TIMELINE;
  const time = clamp(Number.isFinite(t) ? t : 0, 0, tl.total);
  const state = describeTimeline(tl, time);
  const attachment = stageProgress(tl, "attachment", time);
  const injection = stageProgress(tl, "injection", time);
  const takeover = stageProgress(tl, "takeover", time);
  const assembly = stageProgress(tl, "assembly", time);
  const lysis = stageProgress(tl, "lysis", time);
  const assembled = virionsAssembled(assembly);
  const released = Math.round(assembled * smoothstep(lysis));
  return {
    t: time,
    started: time > 0,
    stage: state.stage,
    label: state.label,
    progress: state.progress,
    complete: state.complete,
    attachment,
    attached: stageDone(tl, "attachment", time),
    injection,
    sheathContraction: smoothstep(Math.min(1, injection * 2)),
    genomeInjected: injection,
    injected: stageDone(tl, "injection", time),
    takeover,
    hostDnaIntact: 1 - smoothstep(takeover),
    assembly,
    virionsAssembled: assembled,
    lysis,
    lysed: stageDone(tl, "lysis", time),
    hostAlive: !stageDone(tl, "lysis", time) && lysis < 0.4,
    released,
    burstSize: BURST_SIZE,
  };
}

// ─── The antibiotic ─────────────────────────────────────────────────

export const ANTIBIOTIC_STAGES = [
  { key: "administer", label: "Penicillin arrives", duration: 1.2 },
  { key: "breach", label: "Cross-links fail — the wall shreds", duration: 2.0 },
  { key: "lysis", label: "Osmotic lysis — water rushes in and the cell bursts", duration: 1.5 },
];

export const ANTIBIOTIC_TIMELINE = makeTimeline(ANTIBIOTIC_STAGES);

export function describeAntibiotic(t) {
  const tl = ANTIBIOTIC_TIMELINE;
  const time = clamp(Number.isFinite(t) ? t : 0, 0, tl.total);
  const state = describeTimeline(tl, time);
  const administer = stageProgress(tl, "administer", time);
  const breach = stageProgress(tl, "breach", time);
  const lysis = stageProgress(tl, "lysis", time);
  return {
    t: time,
    started: time > 0,
    stage: state.stage,
    label: state.label,
    progress: state.progress,
    complete: state.complete,
    administer,
    arrived: stageDone(tl, "administer", time),
    breach,
    wallIntegrity: 1 - smoothstep(breach),
    swelling: 0.35 * smoothstep(breach) + 0.25 * smoothstep(Math.min(1, lysis * 2.5)),
    lysis,
    lysed: stageDone(tl, "lysis", time),
    bacterium: antibioticEfficacy("bacterium"),
    virus: antibioticEfficacy("virus"),
  };
}

/** What state the bacterium is in, given both timelines. */
export function hostStatus(infection, antibiotic) {
  if (antibiotic.lysed) return { key: "lysed_antibiotic", label: "lysed by penicillin", alive: false };
  if (infection.lysed) return { key: "lysed_phage", label: "lysed by the phage", alive: false };
  if (antibiotic.started) return { key: "wall_failing", label: "wall failing — swelling", alive: true };
  if (infection.injected) return { key: "hijacked", label: "hijacked — making phage", alive: true };
  if (infection.started) return { key: "under_attack", label: "phage attached", alive: true };
  return { key: "healthy", label: "healthy — dividing", alive: true };
}
