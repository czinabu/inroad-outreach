// The Objections page: type what the prospect said, read the rebuttal and the close, then tap how the call ended.
// The set is static text kept in this browser (no AI call), so it works offline and answers instantly.
// The outcome is logged on the chosen prospect's history in the contact store.
import { allObjectionCalls, contactChoices, logObjectionCall, onContactsChange, undoObjectionCall } from "./contacts.js";
import { el } from "./dom.js";
import { cueFor, demoLibrary, exportLibrary, objectionStats, parseLibrary, quickPicks, rebuttalsFor, searchObjections } from "./objection-library.js";
import { today } from "./contact-store.js";

const LIBRARY_KEY = "sdr-outreach:objections";
const MODE_KEY = "sdr-outreach:objection-mode";
const MAX_MATCHES = 5;
const UNDO_MS = 8000;

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function loadLibrary() {
  try {
    const saved = readStorage(LIBRARY_KEY);
    if (saved) return parseLibrary(saved);
  } catch {
    // A damaged saved set falls back to the demo set rather than breaking the page.
  }
  return demoLibrary();
}

const state = { lib: loadLibrary(), mode: "inside", query: "", openId: null, cursor: 0, contactId: "", said: new Map() };
const saved = readStorage(MODE_KEY);
if (saved === "inside" || saved === "field") state.mode = saved;

const searchEl = document.getElementById("objection-search");
const modeEl = document.getElementById("objection-mode");
const contactEl = document.getElementById("objection-contact");
const resultsEl = document.getElementById("objection-results");
const statusEl = document.getElementById("objection-status");
const errorEl = document.getElementById("objection-error");
const setNameEl = document.getElementById("objection-set-name");
const toastEl = document.getElementById("objection-toast");
const statsEl = document.getElementById("objection-stats");
const viewEl = document.getElementById("objections-view");
let toastTimer = 0;

function say(message, isError = false) {
  statusEl.textContent = isError ? "" : message;
  errorEl.textContent = isError ? message : "";
  errorEl.hidden = !isError;
}

/** Text with [blanks] highlighted, built from text nodes so nothing in a set can inject markup. */
function scriptNode(text, tag = "p") {
  const node = el(tag, "script-text");
  text.split(/(\[[^\]]+\])/).forEach((part) => {
    if (/^\[[^\]]+\]$/.test(part)) node.append(el("mark", "blank", part.slice(1, -1)));
    else if (part) node.append(part);
  });
  return node;
}

function download(name, type, text) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = el("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- Cards -------------------------------------------------------------------

function closeBlock(o) {
  const mode = o.forceMode ?? state.mode;
  const t = state.lib.transitions[mode];
  if (!t.close) return null;
  const box = el("div", "objection-close");
  box.append(el("p", "label", `Then close: ${t.label}`), scriptNode(t.close));
  if (t.assumptive.length) {
    const alt = el("details", "objection-more");
    alt.append(el("summary", "", "If they're already leaning yes"));
    for (const line of t.assumptive) alt.append(scriptNode(line));
    box.append(alt);
  }
  if (t.confirm) {
    const confirm = el("details", "objection-more");
    confirm.append(el("summary", "", "Confirming"), scriptNode(t.confirm));
    box.append(confirm);
  }
  return box;
}

function probeBlock(o) {
  if (!o.probe) return null;
  const box = el("div", "objection-probe");
  box.append(el("p", "label", "Ask first"), scriptNode(o.probe.ask));
  const list = el("ul", "objection-answers");
  for (const answer of o.probe.answers) {
    const item = el("li");
    item.append(el("strong", "", `${answer.label}: `), scriptNode(answer.text, "span"));
    if (answer.coach) item.append(el("small", "muted", ` ${answer.coach}`));
    list.append(item);
  }
  box.append(list);
  return box;
}

function outcomeBar(o, rebuttals) {
  const mode = o.forceMode ?? state.mode;
  const win = el("button", "win-button", mode === "inside" ? "Transferred" : "Booked");
  win.type = "button";
  const lose = el("button", "lose-button", "Lost");
  lose.type = "button";
  const bar = el("div", "objection-outcome");
  const label = el("p", "label", "How did it end?");
  bar.append(label);
  const buttons = el("div", "objection-outcome-buttons");
  buttons.append(win, lose);
  bar.append(buttons);
  const note = el("p", "muted objection-logged");
  note.setAttribute("role", "status");
  bar.append(note);

  const log = (outcome) => {
    if (!state.contactId) {
      note.textContent = "Pick a prospect above to log this call on their history.";
      contactEl.focus();
      return;
    }
    const line = rebuttals[state.said.get(o.id) ?? 0];
    const contactId = state.contactId;
    try {
      const entry = logObjectionCall(contactId, { objectionId: o.id, title: o.title, line: line?.text ?? "", outcome, mode });
      const label = outcome === "won" ? win.textContent : "Lost";
      newCall();
      showToast(`Logged ${label} · ${o.title}`, () => undoObjectionCall(contactId, entry.id));
    } catch (error) {
      note.textContent = error.message;
    }
  };
  win.addEventListener("click", () => log("won"));
  lose.addEventListener("click", () => log("lost"));
  return bar;
}

// After a call is logged the page resets for the next one, and Undo stays up for a few seconds in case of a mis-tap.
function showToast(text, undo) {
  clearTimeout(toastTimer);
  const button = el("button", "link-button", "Undo");
  button.type = "button";
  button.addEventListener("click", () => {
    clearTimeout(toastTimer);
    try {
      undo();
      toastEl.replaceChildren("Undone.");
    } catch (error) {
      toastEl.replaceChildren(error.message);
    }
    toastTimer = setTimeout(() => (toastEl.hidden = true), 2000);
  });
  toastEl.replaceChildren(el("span", "", text), button);
  toastEl.hidden = false;
  toastTimer = setTimeout(() => (toastEl.hidden = true), UNDO_MS);
}

function card(o, { open, number }) {
  const mode = o.forceMode ?? state.mode;
  const rebuttals = rebuttalsFor(o, mode);
  const box = el("details", "objection-card");
  box.open = open;
  const summary = el("summary");
  const title = el("span", "objection-title", o.title);
  if (number) title.prepend(el("kbd", "", String(number)));
  summary.append(title, el("span", "objection-cue", cueFor(o, rebuttals[0])));
  box.append(summary);

  const body = el("div", "objection-body");
  if (o.note) body.append(el("p", "muted", o.note));
  const probe = probeBlock(o);
  if (probe) body.append(probe);

  body.append(el("p", "label", rebuttals.length > 1 ? "Say this (tap the line you used)" : "Say this"));
  rebuttals.forEach((r, i) => {
    const row = el("label", "objection-line");
    const radio = el("input");
    radio.type = "radio";
    radio.name = `said-${o.id}`;
    radio.checked = (state.said.get(o.id) ?? 0) === i;
    radio.addEventListener("change", () => state.said.set(o.id, i));
    const text = el("div");
    text.append(scriptNode(r.text));
    if (r.note) text.append(el("small", "muted", r.note));
    row.append(radio, text);
    body.append(row);
  });

  const close = closeBlock(o);
  if (close) body.append(close);
  body.append(outcomeBar(o, rebuttals));
  box.append(body);
  return box;
}

function renderResults() {
  const lib = state.lib;
  resultsEl.replaceChildren();
  if (state.query.trim()) {
    const matches = searchObjections(lib, state.query);
    if (!matches.length) {
      resultsEl.append(el("p", "muted", `Nothing matches "${state.query.trim()}". Try one word from what they said, like price, busy or think.`));
      return;
    }
    state.cursor = Math.min(state.cursor, Math.min(matches.length, MAX_MATCHES) - 1);
    matches.slice(0, MAX_MATCHES).forEach((o, i) => {
      const c = card(o, { open: i === state.cursor, number: matches.length > 1 ? i + 1 : 0 });
      // Opening one match closes the others, so the card in view is the one that gets logged.
      c.addEventListener("toggle", () => {
        if (c.open && state.cursor !== i) {
          state.cursor = i;
          renderResults();
        }
      });
      resultsEl.append(c);
    });
    return;
  }
  if (state.openId) {
    const o = lib.objections.find((x) => x.id === state.openId);
    if (o) {
      const back = el("button", "link-button", "← All objections");
      back.type = "button";
      back.addEventListener("click", () => {
        state.openId = null;
        renderResults();
      });
      resultsEl.append(back, card(o, { open: true }));
      return;
    }
  }
  const picks = quickPicks(lib);
  if (picks.length) {
    const section = el("section", "objection-group");
    section.append(el("h3", "", "Quick picks (press 1–9)"));
    const row = el("div", "objection-chips");
    picks.forEach((o, i) => {
      const chip = el("button", "objection-chip", o.title);
      chip.prepend(el("kbd", "", String(i + 1)));
      chip.type = "button";
      chip.addEventListener("click", () => openObjection(o.id));
      row.append(chip);
    });
    section.append(row);
    resultsEl.append(section);
  }
  for (const group of lib.groups) {
    const items = lib.objections.filter((o) => o.group === group);
    if (!items.length) continue;
    const section = el("section", "objection-group");
    section.append(el("h3", "", group));
    const row = el("div", "objection-chips");
    for (const o of items) {
      const chip = el("button", "objection-chip", o.title);
      chip.type = "button";
      chip.addEventListener("click", () => openObjection(o.id));
      row.append(chip);
    }
    section.append(row);
    resultsEl.append(section);
  }
}

function openObjection(id) {
  state.openId = id;
  renderResults();
  viewEl.scrollIntoView({ block: "start" });
}

function renderStats() {
  if (!statsEl.open) return;
  const body = statsEl.querySelector(".stats-body");
  const stats = objectionStats(allObjectionCalls());
  if (!stats.length) {
    body.replaceChildren(el("p", "muted", "No calls logged yet. Pick a prospect, open an objection and tap how the call ended."));
    return;
  }
  const list = el("ol", "objection-stats-list");
  for (const o of stats) {
    const item = el("li");
    item.append(el("strong", "", o.title), el("span", "muted", ` ${o.calls} call${o.calls === 1 ? "" : "s"}, ${o.wins} won`));
    const lines = el("ul");
    for (const l of o.lines) {
      const rate = l.rate === null ? `used once` : `${Math.round(l.rate * 100)}% won of ${l.uses}`;
      lines.append(el("li", "", `${rate}: ${l.text.length > 90 ? `${l.text.slice(0, 87)}…` : l.text}`));
    }
    if (o.lines.length) item.append(lines);
    list.append(item);
  }
  body.replaceChildren(list);
}

function renderControls() {
  modeEl.replaceChildren(
    ...["inside", "field"].map((mode) => {
      const option = el("option", "", state.lib.modes[mode].name + (state.lib.modes[mode].hint ? ` (${state.lib.modes[mode].hint})` : ""));
      option.value = mode;
      return option;
    }),
  );
  modeEl.value = state.mode;
  setNameEl.textContent = state.lib.name;
  renderContactChoices();
}

function renderContactChoices() {
  const none = el("option", "", "No prospect (don't log)");
  none.value = "";
  contactEl.replaceChildren(none);
  for (const c of contactChoices()) {
    const option = el("option", "", c.label);
    option.value = c.id;
    contactEl.append(option);
  }
  if (![...contactEl.options].some((o) => o.value === state.contactId)) state.contactId = "";
  contactEl.value = state.contactId;
}

// --- Events ------------------------------------------------------------------

searchEl.addEventListener("input", () => {
  state.query = searchEl.value;
  state.openId = null;
  state.cursor = 0;
  renderResults();
});

// Keyboard, for reps on a live call: type anywhere to search, 1–9 quick picks, ↑ ↓ or Alt+1–9 through matches,
// Enter to stop typing and read, Esc to clear and Esc again for a new call, / to jump back to the search.
document.addEventListener("keydown", (event) => {
  if (viewEl.hidden || event.ctrlKey || event.metaKey) return;
  const target = /** @type {HTMLElement} */ (event.target);
  const inSearch = target === searchEl;
  const radio = target instanceof HTMLInputElement && target.type === "radio";
  if (!inSearch && !radio && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
  if (radio && event.key.startsWith("Arrow")) return;
  const matchCount = Math.min(searchObjections(state.lib, state.query).length, MAX_MATCHES);

  if (event.key === "Escape") {
    event.preventDefault();
    if (state.query || state.openId) {
      state.query = searchEl.value = "";
      state.openId = null;
      state.cursor = 0;
      renderResults();
      searchEl.focus({ preventScroll: true });
    } else newCall();
    return;
  }
  if (event.altKey && /^Digit[1-9]$/.test(event.code)) {
    const n = Number(event.code.slice(5)) - 1;
    if (n < matchCount) {
      event.preventDefault();
      state.cursor = n;
      renderResults();
    }
    return;
  }
  if ((event.key === "ArrowDown" || event.key === "ArrowUp") && matchCount > 1 && (inSearch || !target.closest("details"))) {
    event.preventDefault();
    state.cursor = (state.cursor + (event.key === "ArrowDown" ? 1 : matchCount - 1)) % matchCount;
    renderResults();
    return;
  }
  if (inSearch) {
    if (event.key === "Enter") {
      event.preventDefault();
      searchEl.blur();
    }
    return;
  }
  if (event.altKey) return;
  if (event.key === "/") {
    event.preventDefault();
    searchEl.focus();
    return;
  }
  if (/^[1-9]$/.test(event.key) && !state.query) {
    const pick = quickPicks(state.lib)[Number(event.key) - 1];
    if (pick) {
      event.preventDefault();
      openObjection(pick.id);
    }
    return;
  }
  // Any letter starts a search, wherever the focus is on this page.
  if (event.key.length === 1 && /[a-z]/i.test(event.key)) searchEl.focus({ preventScroll: true });
});

modeEl.addEventListener("change", () => {
  state.mode = modeEl.value;
  writeStorage(MODE_KEY, state.mode);
  renderResults();
});
contactEl.addEventListener("change", () => {
  state.contactId = contactEl.value;
});
function newCall() {
  state.query = "";
  state.openId = null;
  state.cursor = 0;
  state.said.clear();
  searchEl.value = "";
  say("");
  renderResults();
  searchEl.focus({ preventScroll: true });
}
document.getElementById("objection-new-call").addEventListener("click", newCall);
statsEl.addEventListener("toggle", renderStats);

document.getElementById("objection-export").addEventListener("click", () => {
  download(`objections-${today()}.json`, "application/json", exportLibrary(state.lib));
  say("Saved your set as a file.");
});

document.getElementById("objection-import").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  try {
    const lib = parseLibrary(await file.text());
    if (!writeStorage(LIBRARY_KEY, exportLibrary(lib))) throw new Error("This browser couldn't save the set. Its storage may be full.");
    state.lib = lib;
    state.openId = null;
    state.said.clear();
    renderControls();
    renderResults();
    say(`Loaded ${lib.objections.length} objections from ${file.name}.`);
  } catch (error) {
    say(`${file.name}: ${error.message}`, true);
  }
});

document.getElementById("objection-reset").addEventListener("click", () => {
  try {
    window.localStorage.removeItem(LIBRARY_KEY);
  } catch {
    // Nothing saved, or storage is blocked: the demo set is what's shown either way.
  }
  state.lib = demoLibrary();
  state.openId = null;
  state.said.clear();
  renderControls();
  renderResults();
  say("Back to the demo set.");
});

onContactsChange(() => {
  renderContactChoices();
  renderStats();
});

/** Called when the Objections view is shown. */
export function showObjections() {
  renderContactChoices();
  searchEl.focus({ preventScroll: true });
}

renderControls();
renderResults();
