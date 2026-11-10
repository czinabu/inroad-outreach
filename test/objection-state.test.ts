import assert from "node:assert/strict";
import { test } from "node:test";
import { hasSelection, keyAction, selectionMode, typed, type Key, type KeyContext, type Selection } from "../public/objection-state.js";

const browsing: Selection = { query: "", openId: null, cursor: 0 };
const open: Selection = { query: "", openId: "b", cursor: 0 };
const searching: Selection = { query: "price", openId: null, cursor: 1 };
const page: KeyContext = { target: "other", matchCount: 0, listIds: ["a", "b", "c"], quickPickIds: ["b", "c"] };
const matches: KeyContext = { ...page, target: "search", matchCount: 3, listIds: [] };
const NONE = { type: "none", prevent: false };

function press(key: string, extra: Partial<Key> = {}): Key {
  return { key, code: /^\d$/.test(key) ? `Digit${key}` : key, ...extra };
}

test("the search box alone decides between browsing and searching", () => {
  assert.equal(selectionMode(browsing), "browsing");
  assert.equal(selectionMode({ query: "   " }), "browsing");
  assert.equal(selectionMode(searching), "searching");
  assert.deepEqual(typed("busy"), { query: "busy", openId: null, cursor: 0 });
  assert.equal(hasSelection(browsing), false);
  assert.equal(hasSelection(open), true);
  assert.equal(hasSelection(searching), true);
});

test("Esc clears what's picked, and with nothing picked starts a new call", () => {
  assert.deepEqual(keyAction(press("Escape"), searching, matches), { type: "clear", prevent: true });
  assert.deepEqual(keyAction(press("Escape"), open, page), { type: "clear", prevent: true });
  assert.deepEqual(keyAction(press("Escape"), browsing, page), { type: "new-call", prevent: true });
  // Also from a rebuttal's radio button.
  assert.deepEqual(keyAction(press("Escape"), open, { ...page, target: "radio" }), { type: "clear", prevent: true });
});

test("the arrows step through matches when searching, wrapping at both ends", () => {
  assert.deepEqual(keyAction(press("ArrowDown"), searching, matches), { type: "cursor", cursor: 2, prevent: true });
  assert.deepEqual(keyAction(press("ArrowDown"), { ...searching, cursor: 2 }, matches), { type: "cursor", cursor: 0, prevent: true });
  assert.deepEqual(keyAction(press("ArrowUp"), { ...searching, cursor: 0 }, matches), { type: "cursor", cursor: 2, prevent: true });
  // One match or none: the arrow is left to the search box.
  assert.deepEqual(keyAction(press("ArrowDown"), searching, { ...matches, matchCount: 1 }), NONE);
  assert.deepEqual(keyAction(press("ArrowDown"), searching, { ...matches, matchCount: 0 }), NONE);
});

test("the arrows walk the whole list when browsing", () => {
  const walk = (key: string, state: Selection) => keyAction(press(key), state, page);
  assert.deepEqual(walk("ArrowDown", browsing), { type: "open", id: "a", reveal: false, blurSearch: false, prevent: true });
  assert.deepEqual(walk("ArrowUp", browsing), { type: "open", id: "c", reveal: false, blurSearch: false, prevent: true });
  assert.deepEqual(walk("ArrowDown", open), { type: "open", id: "c", reveal: false, blurSearch: false, prevent: true });
  assert.deepEqual(walk("ArrowDown", { ...open, openId: "c" }), { type: "open", id: "a", reveal: false, blurSearch: false, prevent: true });
  assert.deepEqual(walk("ArrowUp", { ...open, openId: "a" }), { type: "open", id: "c", reveal: false, blurSearch: false, prevent: true });
  // An open objection that's no longer in the list starts from the top.
  assert.deepEqual(walk("ArrowDown", { ...open, openId: "gone" }), { type: "open", id: "a", reveal: false, blurSearch: false, prevent: true });
  assert.deepEqual(keyAction(press("ArrowDown"), browsing, { ...page, listIds: [] }), NONE);
});

test("arrows are left alone in a radio group and in the stats section", () => {
  assert.deepEqual(keyAction(press("ArrowDown"), open, { ...page, target: "radio" }), NONE);
  assert.deepEqual(keyAction(press("ArrowDown"), open, { ...page, inStats: true }), NONE);
  assert.deepEqual(keyAction(press("ArrowUp"), searching, { ...matches, target: "other", inStats: true }), NONE);
});

test("1 to 9 open a quick pick while nothing is typed", () => {
  assert.deepEqual(keyAction(press("1"), browsing, page), { type: "open", id: "b", reveal: true, blurSearch: false, prevent: true });
  // From the empty search box too, which then lets go of the focus.
  assert.deepEqual(keyAction(press("2"), browsing, { ...page, target: "search" }), { type: "open", id: "c", reveal: true, blurSearch: true, prevent: true });
  assert.deepEqual(keyAction(press("2"), open, page), { type: "open", id: "c", reveal: true, blurSearch: false, prevent: true });
  // No such pick, or a digit typed into a search: nothing.
  assert.deepEqual(keyAction(press("3"), browsing, page), NONE);
  assert.deepEqual(keyAction(press("1"), searching, matches), NONE);
  assert.deepEqual(keyAction(press("1"), { ...browsing, query: " " }, { ...page, target: "search" }), NONE);
  assert.deepEqual(keyAction(press("0"), browsing, page), NONE);
});

test("Alt+1 to 9 jump to a match", () => {
  assert.deepEqual(keyAction(press("1", { altKey: true }), searching, matches), { type: "cursor", cursor: 0, prevent: true });
  assert.deepEqual(keyAction(press("3", { altKey: true }), searching, matches), { type: "cursor", cursor: 2, prevent: true });
  // macOS turns Alt+1 into another character; the key's position still counts.
  assert.deepEqual(keyAction({ key: "¡", code: "Digit1", altKey: true }, searching, matches), { type: "cursor", cursor: 0, prevent: true });
  assert.deepEqual(keyAction(press("4", { altKey: true }), searching, matches), NONE);
  // Alt+digit never opens a quick pick.
  assert.deepEqual(keyAction(press("1", { altKey: true }), browsing, page), NONE);
});

test("Enter stops typing, and other keys in the search box are just typing", () => {
  assert.deepEqual(keyAction(press("Enter"), searching, matches), { type: "blur-search", prevent: true });
  assert.deepEqual(keyAction(press("p"), searching, matches), NONE);
  assert.deepEqual(keyAction(press("/"), searching, matches), NONE);
  assert.deepEqual(keyAction(press("Enter"), open, page), NONE);
});

test("a letter or / anywhere else on the page goes to the search box", () => {
  assert.deepEqual(keyAction(press("/"), open, page), { type: "focus-search", prevent: true });
  // The letter isn't stopped, so it lands in the box.
  assert.deepEqual(keyAction(press("p"), open, page), { type: "focus-search", prevent: false });
  assert.deepEqual(keyAction(press("P"), open, { ...page, target: "radio" }), { type: "focus-search", prevent: false });
  assert.deepEqual(keyAction(press("Tab"), open, page), NONE);
  assert.deepEqual(keyAction(press(" "), open, page), NONE);
  assert.deepEqual(keyAction(press("p", { altKey: true }), open, page), NONE);
});

test("shortcuts with Ctrl or Cmd, and keys in other fields, are never taken", () => {
  for (const key of ["Escape", "ArrowDown", "1", "/", "p"]) {
    assert.deepEqual(keyAction(press(key, { ctrlKey: true }), open, page), NONE);
    assert.deepEqual(keyAction(press(key, { metaKey: true }), open, page), NONE);
    assert.deepEqual(keyAction(press(key), open, { ...page, target: "field" }), NONE);
  }
});
