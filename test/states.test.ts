import assert from "node:assert/strict";
import { test } from "node:test";
import { ContactStore, followUpState, nextFollowUp } from "../public/contact-store.js";
import { draftPanelNext, draftRoute, modelPickerState, type DraftPanel } from "../public/states.js";

const noServer = { provider: "claude", hasApiKey: false } as const;
const serverKey = { provider: "claude", hasApiKey: true } as const;
const serverLocal = { provider: "local", baseUrl: "http://localhost:11434/v1", model: "gemma4:12b" } as const;

test("a draft goes to the browser's own model, the server's, or nowhere yet", () => {
  const claude = { provider: "claude", budget: false } as const;
  assert.deepEqual(draftRoute(claude, "", noServer), { kind: "setup" });
  assert.deepEqual(draftRoute(claude, "", serverKey), { kind: "server", model: "claude" });
  assert.deepEqual(draftRoute(claude, "", serverLocal), { kind: "server", model: "local", name: "gemma4:12b" });
  // A key entered on the page wins over whatever .env has.
  assert.deepEqual(draftRoute(claude, "sk-ant-1", serverLocal), { kind: "browser-claude", key: "sk-ant-1", budget: false });
  assert.deepEqual(draftRoute({ provider: "claude", budget: true }, "sk-ant-1", noServer), { kind: "browser-claude", key: "sk-ant-1", budget: true });
  // A local model never needs a key or the server's setup.
  assert.deepEqual(draftRoute({ provider: "ollama", budget: true }, "sk-ant-1", serverKey), { kind: "browser-local", provider: "ollama" });
  assert.deepEqual(draftRoute({ provider: "lmstudio", budget: false }, "", noServer), { kind: "browser-local", provider: "lmstudio" });
});

test("the Model field knows whether to list models or ask for a name", () => {
  const kind = (input: Parameters<typeof modelPickerState>[0]) => modelPickerState(input).kind;
  const listed = { models: ["a", "b"], error: "" };
  const none = { models: [], error: "" };
  const down = { models: [], error: "Couldn't reach Ollama" };

  assert.equal(kind({ found: null, checking: false, typing: false }), "unchecked");
  assert.equal(kind({ found: null, checking: true, typing: false }), "checking");
  assert.equal(kind({ found: listed, checking: true, typing: false }), "checking");
  assert.equal(kind({ found: down, checking: false, typing: false }), "unreachable");
  assert.equal(kind({ found: none, checking: false, typing: false }), "empty");
  assert.equal(kind({ found: listed, checking: false, typing: true }), "typing");
  assert.equal(kind({ found: listed, checking: false, typing: false }), "listed");

  // The text box shows when the user asked for it, or when there's nothing to pick from.
  assert.deepEqual(modelPickerState({ found: listed, checking: false, typing: false }), { kind: "listed", manual: false, canPick: true, models: ["a", "b"] });
  assert.equal(modelPickerState({ found: listed, checking: false, typing: true }).manual, true);
  assert.equal(modelPickerState({ found: down, checking: false, typing: false }).manual, true);
  assert.equal(modelPickerState({ found: none, checking: false, typing: false }).canPick, false);
  assert.equal(modelPickerState({ found: null, checking: true, typing: false }).manual, false);
});

test("the results panel goes back to where it was when drafting fails", () => {
  const run = (...events: Parameters<typeof draftPanelNext>[1][]) => events.reduce<DraftPanel>(draftPanelNext, { kind: "empty" });
  assert.deepEqual(run("submit"), { kind: "drafting", back: "empty" });
  assert.deepEqual(run("submit", "failed"), { kind: "empty" });
  assert.deepEqual(run("submit", "drafted"), { kind: "results" });
  assert.deepEqual(run("submit", "drafted", "submit", "failed"), { kind: "results" });
  // A second submit while drafting is ignored, and a late failure (saving) leaves the drafts on screen.
  assert.deepEqual(run("submit", "submit"), { kind: "drafting", back: "empty" });
  assert.deepEqual(run("submit", "drafted", "failed"), { kind: "results" });
  assert.deepEqual(run("drafted"), { kind: "empty" });
  // Saved drafts shown from a contact, or cleared for one without any.
  assert.deepEqual(run("show"), { kind: "results" });
  assert.deepEqual(run("show", "clear"), { kind: "empty" });
  assert.deepEqual(run("submit", "show", "failed"), { kind: "results" });
  assert.deepEqual(run("show", "submit", "clear", "failed"), { kind: "empty" });
});

test("a contact's follow-up state covers every status, date and sequence combination", () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v) };
  const store = new ContactStore(storage, "contacts", () => new Date("2026-10-29T15:00:00Z"));
  const cadence = [
    { day: 1, channel: "Email", action: "Send the first email" },
    { day: 3, channel: "Phone", action: "Call" },
  ];
  const { contact } = store.save({ prospectName: "Dana Lee", company: "Bright Smiles" }, null, cadence);
  const id = contact.id;
  const state = () => followUpState(store.get(id));

  let s = state();
  assert.equal(s.kind, "sequence");
  assert.deepEqual(s.kind === "sequence" && [s.index, s.step.channel, s.date], [0, "Email", store.get(id).sequenceStart]);

  store.update(id, { followUpDate: "2026-11-15" });
  s = state();
  assert.deepEqual(s.kind === "manual" && [s.index, s.step?.channel, s.date], [0, "Email", "2026-11-15"]);

  // Finishing a step drops the manual date; finishing them all leaves nothing scheduled.
  store.update(id, { step: { index: 0, done: true } });
  s = state();
  assert.deepEqual(s.kind === "sequence" && s.index, 1);
  store.update(id, { step: { index: 1, done: true } });
  assert.deepEqual(state(), { kind: "finished" });
  assert.equal(nextFollowUp(store.get(id)), null);

  // A date set after the sequence is finished stands on its own.
  store.update(id, { followUpDate: "2026-12-01" });
  assert.deepEqual(state(), { kind: "manual", date: "2026-12-01", index: -1, step: undefined });
  assert.deepEqual(nextFollowUp(store.get(id)), { date: "2026-12-01", channel: undefined, action: "Follow up" });

  // Any status other than In sequence is out, whatever dates are set.
  store.update(id, { status: "replied" });
  assert.deepEqual(state(), { kind: "out", status: "replied" });
  assert.equal(nextFollowUp(store.get(id)), null);
});
