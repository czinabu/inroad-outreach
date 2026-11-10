// The draft for one sequence step, with copy buttons and links that open it in the right app.
// Used on the contact page, in the Sequence tab and on the Today page.
import { stepDraftFor, stepRequest } from "./contact-store.js";
import { copyButton, el } from "./dom.js";
import { draftingWith, requestStepDraft } from "./models.js";

/** Steps being drafted right now, by "contactId:index", so a re-render keeps showing the spinner. */
const pending = new Map();

/** The SDR's own details, saved by the Draft page's About you section. */
export function senderProfile() {
  const read = (name) => {
    try {
      return localStorage.getItem(`sdr-outreach:${name}`) ?? "";
    } catch {
      return "";
    }
  };
  return { yourName: read("yourName"), yourOffer: read("yourOffer"), goal: read("goal"), tone: read("tone") };
}

export function hasSenderProfile() {
  const sender = senderProfile();
  return Boolean(sender.yourName.trim() && sender.yourOffer.trim());
}

function linkedinHref(contact) {
  const url = (contact.linkedinUrl ?? "").trim();
  if (url) return /^https?:\/\//i.test(url) ? url : `https://${url.replace(/^\/+/, "")}`;
  const keywords = encodeURIComponent(`${contact.prospectName} ${contact.company}`);
  return `https://www.linkedin.com/search/results/people/?keywords=${keywords}`;
}

/** A button-styled link: mailto: with the draft filled in, tel: for the phone, or their LinkedIn profile. */
export function openLink(contact, step, draft) {
  const link = el("a", "button open-link");
  if (step.channel === "Email") {
    const params = new URLSearchParams();
    if (draft?.subject) params.set("subject", draft.subject);
    if (draft?.message) params.set("body", draft.message);
    // URLSearchParams writes spaces as +, which mail apps show literally.
    link.href = `mailto:${encodeURIComponent(contact.email ?? "").replace(/%40/g, "@")}?${params.toString().replace(/\+/g, "%20")}`;
    link.textContent = contact.email ? `Open email to ${contact.email}` : "Open in your email app";
  } else if (step.channel === "Phone") {
    if (!contact.phone) return null;
    link.href = `tel:${contact.phone.replace(/[^\d+]/g, "")}`;
    link.textContent = `Call ${contact.phone}`;
  } else {
    link.href = linkedinHref(contact);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = contact.linkedinUrl ? "Open their LinkedIn" : "Find them on LinkedIn";
  }
  return link;
}

function block(title, text, meta) {
  const wrapper = el("div", "draft-block");
  const head = el("div", "draft-head");
  head.append(el("h3", "", title));
  if (meta) head.append(el("span", "meta", meta));
  head.append(copyButton(() => text));
  wrapper.append(head, el("div", "draft", text));
  return wrapper;
}

const MESSAGE_TITLE = { Email: "Email", LinkedIn: "Message", Phone: "Call opener" };

/** The draft itself: subject, message, talking points and voicemail, whichever the step has. */
function draftBlocks(step, draft) {
  const parts = [];
  if (draft.subject) parts.push(block("Subject", draft.subject));
  if (draft.message) {
    const meta = step.channel === "Email" ? `${draft.message.split(/\s+/).filter(Boolean).length} words` : step.channel === "LinkedIn" ? `${draft.message.length} characters` : "";
    parts.push(block(MESSAGE_TITLE[step.channel], draft.message, meta));
  }
  if (draft.talkingPoints?.length) {
    const wrapper = el("div", "draft-block");
    const head = el("div", "draft-head");
    head.append(el("h3", "", "If they engage, ask"));
    wrapper.append(head);
    const list = el("ul", "questions");
    list.append(...draft.talkingPoints.map((t) => el("li", "", t)));
    wrapper.append(list);
    parts.push(wrapper);
  }
  if (draft.voicemail) parts.push(block("Voicemail", draft.voicemail));
  if (draft.why) parts.push(el("p", "why", draft.why));
  return parts;
}

/**
 * Fills container with the step's draft, or a button to write it.
 * save(contactId, index, draft) stores a new draft and returns the updated contact.
 */
export function renderStepDraft(container, contact, index, { save, onError }) {
  const step = contact.sequence[index];
  const key = `${contact.id}:${index}`;
  const draft = stepDraftFor(contact, index);
  container.replaceChildren();
  container.classList.add("step-draft");

  const write = async (button) => {
    if (pending.has(key)) return;
    button.disabled = true;
    const job = requestStepDraft(stepRequest(contact, index, senderProfile()));
    pending.set(key, job);
    renderStepDraft(container, contact, index, { save, onError });
    let latest = contact;
    try {
      const draft = await job;
      // Clear the spinner before saving: saving re-renders the page, which must show the new draft.
      pending.delete(key);
      latest = (await save(contact.id, index, draft)) ?? contact;
    } catch (error) {
      onError(error.message);
    } finally {
      pending.delete(key);
      if (container.isConnected) renderStepDraft(container, latest, index, { save, onError });
    }
  };

  const state = stepState(contact, index);
  container.dataset.state = state;

  if (state === "writing") {
    const loading = el("p", "step-loading");
    loading.append(el("span", "spinner small"), el("span", "", `Writing this follow-up with ${draftingWith()}...`));
    container.append(loading);
    return;
  }

  if (state === "missing") {
    const empty = el("div", "step-empty");
    const button = el("button", "primary", "Write this follow-up");
    button.type = "button";
    button.addEventListener("click", () => write(button));
    const note = hasSenderProfile()
      ? "Written for this step, knowing what you already sent."
      : "Fill in About you on the Draft page first, so it knows your name and what you sell.";
    empty.append(button, el("p", "muted", note));
    container.append(empty);
    return;
  }

  container.append(...draftBlocks(step, draft));
  const foot = el("div", "step-foot");
  if (draft.source === "first") {
    foot.append(el("span", "muted", "From the first-touch drafts."));
  } else {
    const when = new Date(draft.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const again = el("button", "link-button", "Write a new version");
    again.type = "button";
    again.addEventListener("click", () => write(again));
    foot.append(el("span", "muted", `Written ${when}.`), again);
  }
  container.append(foot);
}

/**
 * A step's draft: "writing" while the model is on it, "ready" when there's one to show (its own, or one from the
 * first-touch drafts), "missing" when it still has to be written.
 * @returns {"writing" | "ready" | "missing"}
 */
export function stepState(contact, index) {
  if (pending.has(`${contact.id}:${index}`)) return "writing";
  return stepDraftFor(contact, index) ? "ready" : "missing";
}

/** Writes the step's draft without showing it, for Write all on the Today page. */
export async function writeStepDraft(contact, index, save) {
  const key = `${contact.id}:${index}`;
  if (pending.has(key)) return pending.get(key);
  const job = requestStepDraft(stepRequest(contact, index, senderProfile()));
  pending.set(key, job);
  try {
    const draft = await job;
    pending.delete(key);
    await save(contact.id, index, draft);
  } finally {
    pending.delete(key);
  }
}
