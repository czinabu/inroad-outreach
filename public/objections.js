// The Objections page: type what the prospect said, read the rebuttal and the close, then tap how the call ended.
// The set is static text kept in this browser (no AI call), so it works offline and answers instantly.
// The outcome is logged on the chosen prospect's history in the contact store.
import { contactChoices, logObjectionCall, onContactsChange } from "./contacts.js";
import { el } from "./dom.js";
import { cueFor, demoLibrary, exportLibrary, parseLibrary, rebuttalsFor, searchObjections } from "./objection-library.js";
import { today } from "./contact-store.js";

const LIBRARY_KEY = "sdr-outreach:objections";
const MODE_KEY = "sdr-outreach:objection-mode";
const MAX_MATCHES = 5;

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

const state = { lib: loadLibrary(), mode: "inside", query: "", openId: null, contactId: "", said: new Map() };
const saved = readStorage(MODE_KEY);
if (saved === "inside" || saved === "field") state.mode = saved;

const searchEl = document.getElementById("objection-search");
const modeEl = document.getElementById("objection-mode");
const contactEl = document.getElementById("objection-contact");
const resultsEl = document.getElementById("objection-results");
const statusEl = document.getElementById("objection-status");
const errorEl = document.getElementById("objection-error");
const setNameEl = document.getElementById("objection-set-name");

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
    try {
      logObjectionCall(state.contactId, { objectionId: o.id, title: o.title, line: line?.text ?? "", outcome, mode });
      note.textContent = `Logged: ${outcome === "won" ? win.textContent : "Lost"}. It's on their history.`;
      win.disabled = lose.disabled = true;
      setTimeout(() => {
        win.disabled = lose.disabled = false;
      }, 1500);
    } catch (error) {
      note.textContent = error.message;
    }
  };
  win.addEventListener("click", () => log("won"));
  lose.addEventListener("click", () => log("lost"));
  return bar;
}

function card(o, { open }) {
  const mode = o.forceMode ?? state.mode;
  const rebuttals = rebuttalsFor(o, mode);
  const box = el("details", "objection-card");
  box.open = open;
  const summary = el("summary");
  summary.append(el("span", "objection-title", o.title), el("span", "objection-cue", cueFor(o, rebuttals[0])));
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
    matches.slice(0, MAX_MATCHES).forEach((o, i) => resultsEl.append(card(o, { open: i === 0 })));
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
  for (const group of lib.groups) {
    const items = lib.objections.filter((o) => o.group === group);
    if (!items.length) continue;
    const section = el("section", "objection-group");
    section.append(el("h3", "", group));
    const row = el("div", "objection-chips");
    for (const o of items) {
      const chip = el("button", "objection-chip", o.title);
      chip.type = "button";
      chip.addEventListener("click", () => {
        state.openId = o.id;
        renderResults();
        window.scrollTo({ top: 0 });
      });
      row.append(chip);
    }
    section.append(row);
    resultsEl.append(section);
  }
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
  renderResults();
});
modeEl.addEventListener("change", () => {
  state.mode = modeEl.value;
  writeStorage(MODE_KEY, state.mode);
  renderResults();
});
contactEl.addEventListener("change", () => {
  state.contactId = contactEl.value;
});
document.getElementById("objection-new-call").addEventListener("click", () => {
  state.query = "";
  state.openId = null;
  state.said.clear();
  searchEl.value = "";
  say("");
  renderResults();
  searchEl.focus();
});

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

onContactsChange(renderContactChoices);

/** Called when the Objections view is shown. */
export function showObjections() {
  renderContactChoices();
  searchEl.focus({ preventScroll: true });
}

renderControls();
renderResults();
