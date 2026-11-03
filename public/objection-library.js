// Objection sets: cleaning an imported file, searching, and exporting. Pure logic with no page code, so tests can run it.
// The file format matches the standalone sdr-objection-handler app, so a set saved there loads here and the other way round.
import { DEMO_LIBRARY } from "./objections-demo.js";

export const MODES = ["inside", "field"];
const MAX_OBJECTIONS = 500;

export class LibraryError extends Error {}

function str(value) {
  return typeof value === "string" ? value.trim() : "";
}

function slug(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "objection";
}

function uniqueId(base, seen) {
  let id = base;
  let n = 2;
  while (seen.has(id)) id = `${base}-${n++}`;
  seen.add(id);
  return id;
}

/** Fills in anything missing so an imported or hand-edited file can't break the page. Throws LibraryError when it isn't a set at all. */
/** @param {any} raw @returns {any} */
export function cleanLibrary(raw) {
  if (!raw || !Array.isArray(raw.objections)) throw new LibraryError('The file needs an "objections" list.');
  /** @type {any} */
  const lib = {
    version: 1,
    name: str(raw.name) || "My objection set",
    modes: {},
    groups: Array.isArray(raw.groups) ? raw.groups.map(str).filter(Boolean) : [],
    objections: [],
    transitions: {},
  };
  for (const mode of MODES) {
    const rawMode = raw.modes?.[mode] ?? {};
    lib.modes[mode] = { name: str(rawMode.name) || DEMO_LIBRARY.modes[mode].name, hint: str(rawMode.hint) };
    const rawClose = raw.transitions?.[mode] ?? {};
    lib.transitions[mode] = {
      label: str(rawClose.label) || DEMO_LIBRARY.transitions[mode].label,
      close: str(rawClose.close),
      confirm: str(rawClose.confirm),
      assumptive: Array.isArray(rawClose.assumptive) ? rawClose.assumptive.map(str).filter(Boolean) : [],
    };
  }
  const seen = new Set();
  for (const o of raw.objections.slice(0, MAX_OBJECTIONS)) {
    if (!o || !str(o.title)) continue;
    const rebuttals = (Array.isArray(o.rebuttals) ? o.rebuttals : [])
      .filter((r) => r && str(r.text))
      .map((r) => {
        const out = { text: str(r.text) };
        if (MODES.includes(r.mode)) out.mode = r.mode;
        if (str(r.note)) out.note = str(r.note);
        return out;
      });
    if (!rebuttals.length) continue;
    const item = {
      id: uniqueId(str(o.id) || slug(o.title), seen),
      title: str(o.title),
      group: str(o.group) || "Other",
      keywords: Array.isArray(o.keywords) ? o.keywords.map(str).filter(Boolean) : [],
      rebuttals,
    };
    if (str(o.note)) item.note = str(o.note);
    if (str(o.cue)) item.cue = str(o.cue);
    if (MODES.includes(o.forceMode)) item.forceMode = o.forceMode;
    if (str(o.probe?.ask) && Array.isArray(o.probe.answers)) {
      const answers = o.probe.answers
        .filter((a) => a && str(a.label) && str(a.text))
        .map((a) => ({ label: str(a.label), text: str(a.text), ...(str(a.coach) ? { coach: str(a.coach) } : {}) }));
      if (answers.length) item.probe = { ask: str(o.probe.ask), answers };
    }
    lib.objections.push(item);
  }
  if (!lib.objections.length) throw new LibraryError("The file has no objections with a title and at least one rebuttal.");
  for (const o of lib.objections) if (!lib.groups.includes(o.group)) lib.groups.push(o.group);
  return lib;
}

/** Parses the text of a saved set. */
/** @returns {any} */
export function parseLibrary(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new LibraryError("That file isn't a saved objection set (it isn't valid JSON).");
  }
  return cleanLibrary(raw);
}

/** The text of a set, for a file the user keeps. */
/** @param {any} lib */
export function exportLibrary(lib) {
  return JSON.stringify(lib, null, 2);
}

/** @returns {any} */
export function demoLibrary() {
  return cleanLibrary(structuredClone(DEMO_LIBRARY));
}

// --- Search ------------------------------------------------------------------

function normalize(text) {
  return text.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

function score(entry, q, words) {
  let total = 0;
  if (entry.title.includes(q)) total += 12;
  for (const keyword of entry.keywords) if (keyword === q) total += 10;
  for (const word of words) {
    if (word.length < 2) continue;
    if (entry.keywords.some((k) => k.split(" ").some((part) => part.startsWith(word)))) total += 4;
    if (entry.title.split(" ").some((part) => part.startsWith(word))) total += 3;
    if (word.length >= 4 && entry.body.includes(word)) total += 1;
  }
  return total;
}

/** Objections that match what the prospect said, best first. An empty query matches nothing. */
/** @param {any} lib @param {string} query @returns {any[]} */
export function searchObjections(lib, query) {
  const q = normalize(query);
  if (!q) return [];
  const words = q.split(" ");
  return lib.objections
    .map((o) => ({
      o,
      s: score(
        { title: normalize(o.title), keywords: o.keywords.map(normalize), body: normalize(o.rebuttals.map((r) => r.text).join(" ")) },
        q,
        words,
      ),
    }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((r) => r.o);
}

/** Rebuttals that suit this call type (those with no type suit both). */
/** @param {any} objection @param {string} mode @returns {any[]} */
export function rebuttalsFor(objection, mode) {
  const own = objection.rebuttals.filter((r) => !r.mode || r.mode === mode);
  return own.length ? own : objection.rebuttals;
}

/** One line to glance at: the card's own cue, else the first sentence of the rebuttal. */
/** @param {any} objection @param {any} rebuttal @returns {string} */
export function cueFor(objection, rebuttal) {
  if (objection.cue) return objection.cue;
  const text = rebuttal.text.replace(/\s+/g, " ");
  const first = (text.match(/^.*?[.!?](?=\s|$)/) ?? [text])[0];
  return first.length > 110 ? `${first.slice(0, 107).replace(/\s+\S*$/, "")}…` : first;
}
