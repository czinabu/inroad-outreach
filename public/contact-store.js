// A light contact list: each saved prospect, the drafts written for them, and where they are in the follow-up sequence.
// Kept in this browser's storage only, so each person's contacts stay on their own device and never reach the server.
// Deals, pipelines and reporting belong in a real CRM; export to CSV for that.

export const STATUSES = {
  active: "In sequence",
  replied: "Replied",
  meeting: "Meeting booked",
  paused: "Paused",
  not_interested: "Not interested",
};

/** Fields the SDR can edit on a saved contact, with their length limits. */
const FIELDS = {
  prospectName: 200,
  prospectTitle: 200,
  company: 200,
  industry: 100,
  companyWebsite: 500,
  notes: 5000,
  email: 200,
  phone: 50,
  linkedinUrl: 500,
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class ContactError extends Error {}

/** Today's date on this computer, as YYYY-MM-DD. */
export function today(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function stepDue(contact, step) {
  return addDays(contact.sequenceStart, step.day - 1);
}

/** The next thing to do for this contact, or null when they're out of the sequence. */
export function nextFollowUp(contact) {
  if (contact.status !== "active") return null;
  const step = contact.sequence.find((s) => !s.doneAt);
  if (contact.followUpDate) {
    return { date: contact.followUpDate, channel: step?.channel, action: step?.action ?? "Follow up" };
  }
  if (!step) return null;
  return { date: stepDue(contact, step), channel: step.channel, action: step.action };
}

// --- Step drafts -------------------------------------------------------------

/**
 * The draft to use for a sequence step. The first email, the first call and the first one or two LinkedIn steps
 * (connection note, then the message after they accept) come from the contact's latest first-touch drafts; every
 * later step gets its own draft, written when it comes due and kept on the step.
 */
export function stepDraftFor(contact, index) {
  const step = contact.sequence[index];
  if (!step) return null;
  if (step.draft) return { source: "step", ...step.draft };
  const first = contact.drafts.at(-1)?.drafts;
  if (!first) return null;
  const sameChannelBefore = contact.sequence.slice(0, index).filter((s) => s.channel === step.channel).length;
  const empty = { subject: "", message: "", voicemail: "", talkingPoints: [], why: "" };
  if (step.channel === "Email" && sameChannelBefore === 0) {
    return { ...empty, source: "first", subject: first.email.subject, message: first.email.body, why: first.email.why };
  }
  if (step.channel === "Phone" && sameChannelBefore === 0) {
    return { ...empty, source: "first", message: first.phone.opener, talkingPoints: first.phone.discoveryQuestions, voicemail: first.phone.voicemail, why: first.phone.why };
  }
  if (step.channel === "LinkedIn" && sameChannelBefore === 0) {
    return { ...empty, source: "first", message: first.linkedin.connectionNote, why: first.linkedin.why };
  }
  if (step.channel === "LinkedIn" && sameChannelBefore === 1) {
    return { ...empty, source: "first", message: first.linkedin.followUpMessage, why: first.linkedin.why };
  }
  return null;
}

/** The /api/steps request for a step: the prospect, the SDR (name, offer, goal, tone) and what was already sent. */
export function stepRequest(contact, index, sender) {
  const step = contact.sequence[index];
  const first = contact.drafts.at(-1)?.drafts;
  const earlier = contact.sequence
    .slice(0, index)
    .filter((s) => s.draft)
    .slice(-4)
    .map((s) => ({ day: s.day, channel: s.channel, text: [s.draft.subject, s.draft.message].filter(Boolean).join("\n").slice(0, 2000) }));
  return {
    prospectName: contact.prospectName,
    prospectTitle: contact.prospectTitle ?? "",
    company: contact.company,
    industry: contact.industry ?? "",
    notes: contact.notes ?? "",
    yourName: sender.yourName ?? "",
    yourOffer: sender.yourOffer ?? "",
    goal: sender.goal ?? "",
    tone: sender.tone || "friendly",
    step: { day: step.day, channel: step.channel, action: step.action },
    touch: index + 1,
    totalTouches: contact.sequence.length,
    firstTouch: first
      ? {
          websiteHook: first.websiteHook ?? "",
          emailSubject: first.email.subject,
          emailBody: first.email.body,
          linkedinNote: first.linkedin.connectionNote,
          voicemail: first.phone.voicemail,
        }
      : undefined,
    earlier,
  };
}

/**
 * Everything due today or overdue, one entry per contact: their next step (index -1 for a manual follow-up date
 * after the sequence is finished). Most overdue first, then by name.
 */
export function dueQueue(contacts, date) {
  return contacts
    .map((contact) => ({ contact, next: nextFollowUp(contact) }))
    .filter(({ next }) => next && next.date <= date)
    .map(({ contact, next }) => ({ contact, index: contact.sequence.findIndex((s) => !s.doneAt), due: next.date }))
    .sort((a, b) => a.due.localeCompare(b.due) || a.contact.prospectName.localeCompare(b.contact.prospectName));
}

/** How many sequence steps were checked off on this date, across all contacts. */
export function doneOn(contacts, date) {
  return contacts.reduce((n, c) => n + c.sequence.filter((s) => s.doneAt && today(new Date(s.doneAt)) === date).length, 0);
}

/** A contact plus what the page needs to show it: its next follow-up and each step's due date. */
export function withSchedule(contact) {
  const done = contact.sequence.filter((s) => s.doneAt).length;
  return {
    ...contact,
    nextFollowUp: nextFollowUp(contact),
    sequence: contact.sequence.map((step) => ({ ...step, due: stepDue(contact, step) })),
    progress: `${done} of ${contact.sequence.length}`,
  };
}

function clean(fields, { partial }) {
  const out = {};
  for (const [name, max] of Object.entries(FIELDS)) {
    if (fields[name] === undefined) {
      if (!partial) out[name] = "";
      continue;
    }
    const value = String(fields[name]).trim();
    if (value.length > max) throw new ContactError(`${name} is too long (${max} characters at most).`);
    out[name] = value;
  }
  if (!partial || "prospectName" in out) if (!out.prospectName) throw new ContactError("Prospect name is required");
  if (!partial || "company" in out) if (!out.company) throw new ContactError("Company is required");
  return out;
}

function sameProspect(a, b) {
  const key = (c) => `${c.prospectName.trim().toLowerCase()}|${c.company.trim().toLowerCase()}`;
  return key(a) === key(b);
}

function newId() {
  return globalThis.crypto.randomUUID();
}

export class ContactStore {
  #storage;
  #key;
  #now;
  #contacts;

  /** storage is localStorage in the page, or anything with getItem/setItem in tests. */
  constructor(storage, key = "sdr-outreach:contacts", now = () => new Date()) {
    this.#storage = storage;
    this.#key = key;
    this.#now = now;
  }

  #load() {
    if (!this.#contacts) {
      let saved = null;
      try {
        saved = JSON.parse(this.#storage.getItem(this.#key) ?? "null");
      } catch {
        // Unreadable storage: start empty rather than break the page.
      }
      this.#contacts = Array.isArray(saved?.contacts) ? saved.contacts : [];
    }
    return this.#contacts;
  }

  #save() {
    try {
      this.#storage.setItem(this.#key, JSON.stringify({ version: 1, contacts: this.#contacts }));
    } catch {
      // Put the list back the way it was on disk, so the page doesn't show changes that weren't saved.
      this.#contacts = undefined;
      throw new ContactError("This browser couldn't save your contacts. Its storage may be full: export a backup, then delete old contacts.");
    }
  }

  /** Forget the copy in memory, for when another tab changed the list. */
  reload() {
    this.#contacts = undefined;
  }

  list() {
    return this.#load();
  }

  get(id) {
    const contact = this.#load().find((c) => c.id === id);
    if (!contact) throw new ContactError("That contact doesn't exist. It may have been deleted.");
    return contact;
  }

  /**
   * Saves a prospect, or adds the drafts to their history if they're already saved (same name and company).
   * cadence is the industry's follow-up sequence, used for a new contact.
   */
  save(input, drafts, cadence = []) {
    const fields = clean(input, { partial: false });
    const now = this.#now().toISOString();
    let contact = this.#load().find((c) => sameProspect(c, fields));
    const created = !contact;
    if (!contact) {
      contact = {
        ...fields,
        id: newId(),
        createdAt: now,
        updatedAt: now,
        status: "active",
        sequenceStart: today(this.#now()),
        sequence: cadence.map(({ day, channel, action }) => ({ day, channel, action })),
        drafts: [],
        activity: [{ at: now, text: "Saved to contacts" }],
      };
      this.#contacts.push(contact);
    } else {
      // Fill in anything new from the form without wiping what the SDR already saved.
      for (const [key, value] of Object.entries(fields)) {
        if (value) contact[key] = value;
      }
      contact.updatedAt = now;
    }
    if (drafts) {
      contact.drafts.push({ id: newId(), createdAt: now, drafts });
      contact.activity.push({ at: now, text: "Drafts written" });
    }
    this.#save();
    return { contact, created };
  }

  update(id, changes) {
    const contact = this.get(id);
    const now = this.#now().toISOString();
    const { step, status, sequenceStart, followUpDate, ...rest } = changes;
    const fields = clean(rest, { partial: true });
    if (status !== undefined && !(status in STATUSES)) throw new ContactError("That status doesn't exist.");
    for (const date of [sequenceStart, followUpDate]) {
      if (date && !ISO_DATE.test(date)) throw new ContactError("Dates must look like 2026-10-29");
    }
    Object.assign(contact, fields);

    if (status && status !== contact.status) {
      contact.status = status;
      contact.activity.push({ at: now, text: `Status: ${STATUSES[status]}` });
    }
    if (sequenceStart) contact.sequenceStart = sequenceStart;
    if (followUpDate !== undefined) {
      if (followUpDate) contact.followUpDate = followUpDate;
      else delete contact.followUpDate;
    }
    if (step) {
      const target = contact.sequence[step.index];
      if (!target) throw new ContactError("That sequence step doesn't exist.");
      if (step.done && !target.doneAt) {
        target.doneAt = now;
        contact.activity.push({ at: now, text: `Done: Day ${target.day} ${target.channel}, ${target.action.toLowerCase()}` });
        // A manual follow-up date was for this touch; the next one comes from the sequence again.
        delete contact.followUpDate;
      } else if (!step.done && target.doneAt) {
        delete target.doneAt;
        contact.activity.push({ at: now, text: `Undone: Day ${target.day} ${target.channel}` });
      }
    }
    contact.updatedAt = now;
    this.#save();
    return contact;
  }

  /** Keeps a drafted follow-up on its sequence step, replacing any earlier draft for that step. */
  saveStepDraft(id, index, draft) {
    const contact = this.get(id);
    const step = contact.sequence[index];
    if (!step) throw new ContactError("That sequence step doesn't exist.");
    const now = this.#now().toISOString();
    const text = (value, max) => String(value ?? "").slice(0, max);
    step.draft = {
      subject: text(draft.subject, 300),
      message: text(draft.message, 5000),
      voicemail: text(draft.voicemail, 2000),
      talkingPoints: (Array.isArray(draft.talkingPoints) ? draft.talkingPoints : []).slice(0, 6).map((t) => text(t, 500)),
      why: text(draft.why, 1000),
      createdAt: now,
    };
    contact.activity.push({ at: now, text: `Drafted: Day ${step.day} ${step.channel}` });
    contact.updatedAt = now;
    this.#save();
    return contact;
  }

  /**
   * Logs how an objection went on a call: which objection, which rebuttal was said, and whether it ended well.
   * A win (transferred or booked) moves a prospect who's still in play to "Meeting booked".
   */
  logObjection(id, { objectionId, title, line = "", outcome, mode = "" }) {
    if (outcome !== "won" && outcome !== "lost") throw new ContactError("The outcome must be won or lost.");
    const contact = this.get(id);
    const now = this.#now().toISOString();
    const entry = { id: newId(), at: now, objectionId: String(objectionId).slice(0, 200), title: String(title).slice(0, 200), line: String(line).slice(0, 300), mode, outcome, statusBefore: contact.status };
    (contact.objectionCalls ??= []).push(entry);
    contact.activity.push({ at: now, callId: entry.id, text: `Call: "${entry.title}", ${outcome === "won" ? "won" : "lost"}${entry.line ? ` (said: ${entry.line.slice(0, 80)})` : ""}` });
    if (outcome === "won" && (contact.status === "active" || contact.status === "replied")) {
      contact.status = "meeting";
      contact.activity.push({ at: now, callId: entry.id, text: `Status: ${STATUSES.meeting}` });
    }
    contact.updatedAt = now;
    this.#save();
    return entry;
  }

  /** Takes back a logged call, for a mis-tap: removes it and its history lines, and puts the status back if the call changed it. */
  undoObjection(id, callId) {
    const contact = this.get(id);
    const entry = contact.objectionCalls?.find((c) => c.id === callId);
    if (!entry) throw new ContactError("That call isn't on their history any more.");
    contact.objectionCalls = contact.objectionCalls.filter((c) => c !== entry);
    const changedStatus = contact.activity.some((a) => a.callId === callId && a.text.startsWith("Status:"));
    contact.activity = contact.activity.filter((a) => a.callId !== callId);
    if (changedStatus && contact.status === "meeting") contact.status = entry.statusBefore;
    contact.updatedAt = this.#now().toISOString();
    this.#save();
  }

  delete(id) {
    this.get(id);
    this.#contacts = this.#load().filter((c) => c.id !== id);
    this.#save();
  }

  /** Adds contacts from a backup, skipping any already saved (same id, or same name and company). Returns how many were added. */
  importContacts(contacts) {
    const list = this.#load();
    let added = 0;
    for (const contact of contacts) {
      if (!contact?.id || !contact.prospectName || !contact.company || !Array.isArray(contact.sequence) || !Array.isArray(contact.drafts)) continue;
      if (list.some((c) => c.id === contact.id || sameProspect(c, contact))) continue;
      list.push({ activity: [], status: "active", ...contact });
      added++;
    }
    if (added) this.#save();
    return added;
  }

  /** Everything, for a backup file the user keeps. */
  backup() {
    return JSON.stringify({ version: 1, exportedAt: this.#now().toISOString(), contacts: this.#load() }, null, 2);
  }
}

// --- CSV export --------------------------------------------------------------

/** labels maps industry keys to names, e.g. { healthcare: "Healthcare" }. */
function csvColumns(labels) {
  return [
    ["Name", (c) => c.prospectName],
    ["Title", (c) => c.prospectTitle],
    ["Company", (c) => c.company],
    ["Industry", (c) => labels[c.industry] ?? c.industry],
    ["Email", (c) => c.email],
    ["Phone", (c) => c.phone],
    ["LinkedIn", (c) => c.linkedinUrl],
    ["Website", (c) => c.companyWebsite],
    ["Status", (c) => STATUSES[c.status]],
    ["Next follow-up", (c) => nextFollowUp(c)?.date ?? ""],
    [
      "Next step",
      (c) => {
        const next = nextFollowUp(c);
        return next ? [next.channel, next.action].filter(Boolean).join(": ") : "";
      },
    ],
    ["Touches done", (c) => String(c.sequence.filter((s) => s.doneAt).length)],
    ["Last activity", (c) => (c.activity.length ? today(new Date(c.activity.at(-1).at)) : "")],
    ["Notes", (c) => c.notes],
    ["Last email subject", (c) => c.drafts.at(-1)?.drafts.email.subject ?? ""],
    ["Last email body", (c) => c.drafts.at(-1)?.drafts.email.body ?? ""],
    ["Added", (c) => today(new Date(c.createdAt))],
  ];
}

function csvCell(value) {
  const text = String(value ?? "");
  // Spreadsheets run a cell starting with = @ + or - as a formula, so a draft or note could hide one.
  // A leading quote mark keeps it plain text; phone numbers like +1 555 are left alone.
  const safe = /^(?:[=@\t\r]|[+-][^\d\s(])/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function contactsCsv(contacts, labels = {}) {
  const columns = csvColumns(labels);
  const rows = [columns.map(([name]) => name), ...contacts.map((c) => columns.map(([, get]) => get(c)))];
  // The byte-order mark makes Excel read accents and curly quotes correctly.
  return `﻿${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
