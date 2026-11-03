import assert from "node:assert/strict";
import { test } from "node:test";
import { ContactError, ContactStore } from "../public/contact-store.js";
import { LibraryError, cleanLibrary, cueFor, demoLibrary, exportLibrary, parseLibrary, rebuttalsFor, searchObjections } from "../public/objection-library.js";
import { PLAYBOOKS } from "../server/playbooks.ts";

class MemoryStorage {
  items = new Map<string, string>();
  getItem(key: string) {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

test("the demo set is valid and survives an export and import round trip", () => {
  const lib = demoLibrary();
  assert.ok(lib.objections.length > 10);
  assert.deepEqual(parseLibrary(exportLibrary(lib)), lib);
});

test("search finds an objection by what the prospect said", () => {
  const lib = demoLibrary();
  assert.equal(searchObjections(lib, "not interested")[0].id, "not-interested");
  assert.equal(searchObjections(lib, "").length, 0);
  assert.equal(searchObjections(lib, "zzzzqqq").length, 0);
});

test("cleaning drops bad entries, fills defaults and makes ids unique", () => {
  const lib = cleanLibrary({
    name: "  Mine ",
    objections: [
      { title: "Price", rebuttals: [{ text: "It pays for itself." }] },
      { title: "Price", rebuttals: [{ text: "Second.", mode: "field" }, { text: "" }] },
      { title: "No rebuttal", rebuttals: [] },
      { rebuttals: [{ text: "No title" }] },
      null,
    ],
  });
  assert.equal(lib.name, "Mine");
  assert.deepEqual(lib.objections.map((o: { id: string }) => o.id), ["price", "price-2"]);
  assert.equal(lib.objections[0].group, "Other");
  assert.deepEqual(lib.groups, ["Other"]);
  assert.equal(lib.modes.inside.name, "Transfer");
});

test("a file that isn't an objection set is refused with a clear message", () => {
  assert.throws(() => parseLibrary("not json"), LibraryError);
  assert.throws(() => parseLibrary("{}"), /objections/);
  assert.throws(() => cleanLibrary({ objections: [{ title: "x", rebuttals: [] }] }), /no objections/);
});

test("rebuttals suit the call type, and cues fall back to the first sentence", () => {
  const o = cleanLibrary({
    objections: [{ title: "Busy", rebuttals: [{ text: "Both. Yes." }, { text: "Field only.", mode: "field" }] }],
  }).objections[0];
  assert.deepEqual(rebuttalsFor(o, "inside").map((r) => r.text), ["Both. Yes."]);
  assert.equal(rebuttalsFor(o, "field").length, 2);
  assert.equal(cueFor(o, o.rebuttals[0]), "Both.");
  assert.equal(cueFor({ ...o, cue: "Glance" }, o.rebuttals[0]), "Glance");
});

function storeWithContact() {
  const store = new ContactStore(new MemoryStorage());
  const { contact } = store.save({ prospectName: "Dana Lee", company: "Bright Smiles", industry: "healthcare" }, null, PLAYBOOKS.healthcare.cadence);
  return { store, id: contact.id };
}

test("a won call is logged on the prospect and marks them as booked", () => {
  const { store, id } = storeWithContact();
  store.logObjection(id, { objectionId: "busy", title: "Too busy", line: "Two minutes.", outcome: "won", mode: "field" });
  const contact = store.get(id);
  assert.equal(contact.objectionCalls.length, 1);
  assert.equal(contact.objectionCalls[0].outcome, "won");
  assert.equal(contact.status, "meeting");
  assert.match(contact.activity.at(-2).text, /Too busy.*won.*Two minutes/);
});

test("a lost call is logged without changing the prospect's status", () => {
  const { store, id } = storeWithContact();
  store.logObjection(id, { objectionId: "busy", title: "Too busy", outcome: "lost" });
  assert.equal(store.get(id).status, "active");
  assert.equal(store.get(id).objectionCalls[0].outcome, "lost");
});

test("logging refuses a bad outcome or a missing prospect", () => {
  const { store, id } = storeWithContact();
  assert.throws(() => store.logObjection(id, { objectionId: "x", title: "x", outcome: "maybe" }), ContactError);
  assert.throws(() => store.logObjection("nope", { objectionId: "x", title: "x", outcome: "won" }), ContactError);
});
