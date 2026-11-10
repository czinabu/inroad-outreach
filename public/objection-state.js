// @ts-check
// The Objections page's selection and keyboard rules, with no page code, so tests can run them.
// The page keeps the state and does what keyAction says; nothing here touches the document.

/**
 * What's picked on the page. The page is in one of two modes, decided by the search box alone:
 * - browsing (nothing typed): the whole list shows, and openId is the objection in the panel (null for none).
 * - searching (something typed): the matches show, and cursor is which match is in the panel.
 * openId is ignored while searching and cursor while browsing; both reset whenever the search text changes.
 * @typedef {{ query: string, openId: string | null, cursor: number }} Selection
 */

/**
 * @param {{ query: string }} state
 * @returns {"browsing" | "searching"}
 */
export function selectionMode(state) {
  return state.query.trim() ? "searching" : "browsing";
}

/** The selection after the search text changes: nothing open, first match. @param {string} query @returns {Selection} */
export function typed(query) {
  return { query, openId: null, cursor: 0 };
}

/** Whether Esc has something to clear before it starts a new call. @param {Selection} state */
export function hasSelection(state) {
  return Boolean(state.query || state.openId);
}

/**
 * A key press, as the page's keydown event gives it.
 * @typedef {{ key: string, code: string, altKey?: boolean, ctrlKey?: boolean, metaKey?: boolean }} Key
 */

/**
 * Where the key was pressed and what's on screen.
 * - target: "search" (the search box), "radio" (a rebuttal's radio button), "field" (any other input, select or
 *   text box) or "other".
 * - inStats: the focus is inside the stats section, which keeps its own arrow keys.
 * - matchCount: how many matches are listed for the current search (0 when browsing).
 * - listIds: every objection's id in list order, for walking with the arrows when browsing.
 * - quickPickIds: the ids that 1 to 9 open.
 * @typedef {{ target: "search" | "radio" | "field" | "other", inStats?: boolean, matchCount: number, listIds: string[], quickPickIds: string[] }} KeyContext
 */

/**
 * What a key press does. prevent says whether to stop the browser's own handling of the key.
 * - none: nothing.
 * - clear: empty the search, close the panel and focus the search box.
 * - new-call: reset the page for the next call.
 * - cursor: move to match number `cursor` (searching).
 * - open: show objection `id` in the panel (browsing); reveal says to scroll to it on a phone, as a click does.
 * - blur-search: stop typing, to read.
 * - focus-search: put the focus in the search box.
 * @typedef {{ type: "none", prevent: false }
 *   | { type: "clear", prevent: true }
 *   | { type: "new-call", prevent: true }
 *   | { type: "cursor", cursor: number, prevent: true }
 *   | { type: "open", id: string, reveal: boolean, blurSearch: boolean, prevent: true }
 *   | { type: "blur-search", prevent: true }
 *   | { type: "focus-search", prevent: boolean }} KeyAction
 */

/** @type {KeyAction} */
const NONE = { type: "none", prevent: false };

/**
 * The keyboard, for reps on a live call: type anywhere to search, 1–9 quick picks, ↑ ↓ or Alt+1–9 through matches,
 * Enter to stop typing and read, Esc to clear and Esc again for a new call, / to jump back to the search.
 * @param {Key} key
 * @param {Selection} state
 * @param {KeyContext} context
 * @returns {KeyAction}
 */
export function keyAction(key, state, context) {
  if (key.ctrlKey || key.metaKey) return NONE;
  const { target, matchCount } = context;
  // Other fields keep their keys, and a radio group keeps its arrows.
  if (target === "field") return NONE;
  if (target === "radio" && key.key.startsWith("Arrow")) return NONE;
  const searching = selectionMode(state) === "searching";

  if (key.key === "Escape") return hasSelection(state) ? { type: "clear", prevent: true } : { type: "new-call", prevent: true };

  if (key.altKey && /^Digit[1-9]$/.test(key.code)) {
    const n = Number(key.code.slice(5)) - 1;
    return n < matchCount ? { type: "cursor", cursor: n, prevent: true } : NONE;
  }

  if ((key.key === "ArrowDown" || key.key === "ArrowUp") && !context.inStats) {
    const step = key.key === "ArrowDown" ? 1 : -1;
    if (searching) {
      if (matchCount < 2) return NONE;
      return { type: "cursor", cursor: (state.cursor + step + matchCount) % matchCount, prevent: true };
    }
    // With nothing typed, the arrows walk the whole list and preview each objection in the panel.
    const ids = context.listIds;
    if (!ids.length) return NONE;
    const at = state.openId === null ? -1 : ids.indexOf(state.openId);
    const next = at < 0 ? (step > 0 ? 0 : ids.length - 1) : (at + step + ids.length) % ids.length;
    return { type: "open", id: ids[next], reveal: false, blurSearch: false, prevent: true };
  }

  // 1–9 open a quick pick even from the empty search box, so the page is ready the moment it opens.
  if (/^[1-9]$/.test(key.key) && !key.altKey && !state.query) {
    const id = context.quickPickIds[Number(key.key) - 1];
    return id ? { type: "open", id, reveal: true, blurSearch: target === "search", prevent: true } : NONE;
  }

  if (target === "search") return key.key === "Enter" ? { type: "blur-search", prevent: true } : NONE;
  if (key.altKey) return NONE;
  if (key.key === "/") return { type: "focus-search", prevent: true };
  // Any letter starts a search, wherever the focus is on this page.
  if (key.key.length === 1 && /[a-z]/i.test(key.key)) return { type: "focus-search", prevent: false };
  return NONE;
}
