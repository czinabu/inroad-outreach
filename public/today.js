// Today: every follow-up that's due, one at a time. Open the draft in the right app, send it, mark it done, next.
import { addDays, doneOn, dueQueue, stepDraftFor } from "./contact-store.js";
import { allContacts, saveStepDraft, updateContact } from "./contacts.js";
import { dueLabel, el } from "./dom.js";
import { hasSenderProfile, openLink, renderStepDraft, stepState, writeStepDraft } from "./step-draft.js";

const listEl = document.getElementById("today-list");
const cardEl = document.getElementById("today-card");
const summaryEl = document.getElementById("today-summary");
const errorEl = document.getElementById("today-error");
const writeAllButton = document.getElementById("today-write-all");
const layoutEl = document.getElementById("today-layout");
const emptyEl = document.getElementById("today-empty");

const state = { selected: null, date: "", writingAll: false, onOpenObjections: () => {}, onOpenContact: () => {} };

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function showError(message) {
  errorEl.textContent = message || "";
  errorEl.hidden = !message;
}

function queue() {
  return dueQueue(allContacts(), state.date);
}

/** Steps still to be written in today's queue (not counting ones that come from the first-touch drafts). */
function missingDrafts(items) {
  return items.filter(({ contact, index }) => index >= 0 && stepState(contact, index) === "missing");
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function renderList(items) {
  listEl.replaceChildren(
    ...items.map(({ contact, index, due }) => {
      const step = contact.sequence[index];
      const item = el("li");
      const button = el("button", "contact-row");
      button.type = "button";
      if (contact.id === state.selected) button.setAttribute("aria-current", "true");
      const who = el("span", "who");
      who.append(el("strong", "", contact.prospectName), el("span", "muted", step ? `${step.channel} · ${step.action}` : "Follow up"));
      const label = dueLabel(due, state.date);
      const status = stepState(contact, index);
      const side = el("span", `next ${label.state}`, label.text);
      if (index >= 0) side.append(el("span", `draft-state ${status}`, status === "ready" ? "Draft ready" : status === "writing" ? "Writing..." : "No draft yet"));
      button.append(el("span", `avatar ${step ? step.channel.toLowerCase() : ""}`, initials(contact.prospectName)), who, side);
      button.addEventListener("click", () => {
        state.selected = contact.id;
        showError("");
        render();
        if (window.innerWidth < 1024) cardEl.scrollIntoView({ behavior: "smooth" });
      });
      item.append(button);
      return item;
    }),
  );
}

function actionButton(label, className, handler) {
  const button = el("button", className, label);
  button.type = "button";
  button.addEventListener("click", async () => {
    button.disabled = true;
    showError("");
    try {
      await handler();
    } catch (error) {
      showError(error.message);
      button.disabled = false;
    }
  });
  return button;
}

/** After the current contact leaves the queue, pick whoever is now in the same spot. */
async function advance(items, change) {
  const position = items.findIndex((i) => i.contact.id === state.selected);
  await change();
  const rest = queue();
  state.selected = rest[Math.min(position, rest.length - 1)]?.contact.id ?? null;
  render();
}

function renderCard(items) {
  const current = items.find((i) => i.contact.id === state.selected);
  if (!current) {
    cardEl.replaceChildren();
    return;
  }
  const { contact, index, due } = current;
  const step = contact.sequence[index];

  const head = el("div", "detail-head");
  const title = el("div", "detail-title");
  const name = el("div");
  title.append(el("span", "avatar large", initials(contact.prospectName)), name);
  name.append(el("h2", "", contact.prospectName), el("p", "muted", [contact.prospectTitle, contact.company].filter(Boolean).join(" at ")));
  const open = el("button", "secondary", "Open contact");
  open.type = "button";
  open.addEventListener("click", () => state.onOpenContact(contact.id));
  head.append(title, open);

  const stepLine = el("div", `today-step ${step ? step.channel.toLowerCase() : ""}`);
  const label = dueLabel(due, state.date);
  if (step) {
    stepLine.append(
      el("span", "channel", step.channel),
      el("span", "today-step-text", `Touch ${index + 1} of ${contact.sequence.length} · Day ${step.day}: ${step.action}`),
    );
  } else {
    stepLine.append(el("span", "today-step-text", "Follow-up date you set. The sequence is finished."));
  }
  if (label.state !== "later") stepLine.append(el("span", `due ${label.state}`, label.text));

  const body = el("div", "today-body");
  if (step) {
    const links = el("div", "today-links");
    const link = openLink(contact, step, stepDraftFor(contact, index));
    if (link) links.append(link);
    if (step.channel === "Phone") {
      if (!contact.phone) links.append(el("span", "muted", "No phone number saved. Add it on their contact page."));
      const objections = el("button", "secondary", "Objections for this call");
      objections.type = "button";
      objections.addEventListener("click", () => state.onOpenObjections(contact.id));
      links.append(objections);
    }
    if (step.channel === "Email" && !contact.email) links.append(el("span", "muted", "No email address saved yet."));
    const draft = el("div");
    renderStepDraft(draft, contact, index, { save: saveStepDraft, onError: showError });
    body.append(links, draft);
  }

  const actions = el("div", "today-actions");
  const done = actionButton(step ? "Mark done, next" : "Done, next", "primary", () =>
    advance(items, () => (step ? updateContact(contact.id, { step: { index, done: true } }) : updateContact(contact.id, { followUpDate: null }))),
  );
  const snooze = actionButton("Tomorrow", "secondary", () => advance(items, () => updateContact(contact.id, { followUpDate: addDays(state.date, 1) })));
  snooze.title = "Move this touch to tomorrow";
  const replied = actionButton("They replied", "link-button", () => advance(items, () => updateContact(contact.id, { status: "replied" })));
  replied.title = "Takes them out of the sequence";
  actions.append(done, snooze, replied);

  cardEl.replaceChildren(head, stepLine, body, actions);
}

function render() {
  if (document.getElementById("today-view").hidden) return;
  state.date = localToday();
  const contacts = allContacts();
  const items = queue();
  if (!items.some((i) => i.contact.id === state.selected)) state.selected = items[0]?.contact.id ?? null;

  const doneToday = doneOn(contacts, state.date);
  const missing = missingDrafts(items).length;
  summaryEl.textContent = items.length
    ? `${items.length} to do${doneToday ? ` · ${doneToday} done today` : ""}${missing ? ` · ${missing} still need a draft` : ""}`
    : "";

  layoutEl.hidden = items.length === 0;
  emptyEl.hidden = items.length > 0;
  if (!items.length) {
    const tomorrow = dueQueue(contacts, addDays(state.date, 1)).length;
    emptyEl.querySelector("h2").textContent = contacts.length ? (doneToday ? `All done for today: ${doneToday} touches sent.` : "Nothing due today.") : "No contacts yet.";
    emptyEl.querySelector("p").textContent = contacts.length
      ? tomorrow
        ? `${tomorrow} ${tomorrow === 1 ? "is" : "are"} due by tomorrow.`
        : "Save more prospects from the Draft page to keep your pipeline full."
      : "Draft outreach for a prospect and press Save to contacts. Their follow-ups show up here on the day they're due.";
  }

  writeAllButton.hidden = missing === 0 && !state.writingAll;
  writeAllButton.disabled = state.writingAll || !hasSenderProfile();
  writeAllButton.title = hasSenderProfile() ? "Write every missing follow-up draft in today's list" : "Fill in About you on the Draft page first";
  if (!state.writingAll) writeAllButton.textContent = missing === 1 ? "Write the missing draft" : `Write all ${missing} drafts`;

  renderList(items);
  renderCard(items);
}

writeAllButton.addEventListener("click", async () => {
  const todo = missingDrafts(queue());
  if (!todo.length) return;
  state.writingAll = true;
  showError("");
  try {
    for (const [n, { contact, index }] of todo.entries()) {
      writeAllButton.textContent = `Writing ${n + 1} of ${todo.length}...`;
      render();
      await writeStepDraft(contact, index, saveStepDraft);
    }
  } catch (error) {
    showError(error.message);
  } finally {
    state.writingAll = false;
    render();
  }
});

export function renderToday() {
  render();
}

/** onOpenObjections(contactId) opens the Objections page set to log calls on that contact; onOpenContact opens their contact page. */
export function initToday({ onOpenObjections, onOpenContact }) {
  state.onOpenObjections = onOpenObjections;
  state.onOpenContact = onOpenContact;
}
