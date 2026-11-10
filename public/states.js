// @ts-check
// The app's state machines, as plain functions with no page code, so tests can run them and the pages only draw
// what they return. Each one answers "which state is this in?" in one place, instead of each page re-deriving it
// from flags. A state is an object with a `kind`; switch on it.
//
//   draftRoute        who writes a draft: nobody yet, the app's server, or the browser calling Claude or a local model
//   modelPickerState  the Model field on the settings page: unchecked, checking, unreachable, empty, typing or listed
//   draftPanelNext    the results panel on the Draft page: empty, drafting or results
//
// The follow-up schedule (followUpState) lives in contact-store.js, next to the contact data it reads.

// --- Who writes the draft ----------------------------------------------------

/**
 * What the Model settings page saved. Only the fields the route depends on.
 * @typedef {{ provider: "claude" | "lmstudio" | "ollama", budget: boolean }} RouteSettings
 */

/**
 * What the app's server drafts with from .env (see ServerModel in server/app.ts).
 * @typedef {{ provider: "claude", hasApiKey?: boolean } | { provider: "local", baseUrl: string, model: string }} RouteServerModel
 */

/**
 * Where a draft request goes.
 * - setup: nothing can draft yet; send the user to Model settings.
 * - server: the app's server drafts with its .env setup (a Claude key, or a local model).
 * - browser-claude: this page calls Anthropic with the key entered here.
 * - browser-local: this page calls LM Studio or Ollama on this computer.
 * @typedef {{ kind: "setup" }
 *   | { kind: "server", model: "claude" }
 *   | { kind: "server", model: "local", name: string }
 *   | { kind: "browser-claude", key: string, budget: boolean }
 *   | { kind: "browser-local", provider: "lmstudio" | "ollama" }} DraftRoute
 */

/**
 * @param {RouteSettings} settings
 * @param {string} apiKey the Anthropic key entered on this page, or "" for none
 * @param {RouteServerModel} serverModel
 * @returns {DraftRoute}
 */
export function draftRoute(settings, apiKey, serverModel) {
  if (settings.provider !== "claude") return { kind: "browser-local", provider: settings.provider };
  if (apiKey) return { kind: "browser-claude", key: apiKey, budget: settings.budget };
  // Claude without a key here uses the server's own setup from .env.
  if (serverModel.provider === "local") return { kind: "server", model: "local", name: serverModel.model };
  if (serverModel.hasApiKey) return { kind: "server", model: "claude" };
  return { kind: "setup" };
}

// --- The Model field ---------------------------------------------------------

/**
 * What a local server said it has. error is set when it couldn't be asked.
 * @typedef {{ models: string[], error: string }} Detected
 */

/**
 * The Model field's state.
 * - unchecked: the server hasn't been asked yet.
 * - checking: waiting for its answer.
 * - unreachable: it couldn't be asked, so the name has to be typed.
 * - empty: it answered, with no models, so the name has to be typed.
 * - typing: it listed models, but the user chose to type a name.
 * - listed: pick from the models it has.
 *
 * manual says whether the text box (rather than the list) is shown; canPick whether there's a list to go back to.
 * @typedef {{ kind: "unchecked" | "checking" | "unreachable" | "empty" | "typing" | "listed", manual: boolean, canPick: boolean, models: string[] }} ModelPickerState
 */

/**
 * @param {{ found: Detected | null, checking: boolean, typing: boolean }} input
 *   found is the server's last answer (null until it has answered once), checking whether a lookup the user is
 *   waiting on is in flight, typing whether they asked for the text box.
 * @returns {ModelPickerState}
 */
export function modelPickerState({ found, checking, typing }) {
  const models = found?.models ?? [];
  const canPick = models.length > 0;
  const manual = typing || (found !== null && !canPick);
  /** @type {ModelPickerState["kind"]} */
  let kind;
  if (checking) kind = "checking";
  else if (!found) kind = typing ? "typing" : "unchecked";
  else if (found.error) kind = "unreachable";
  else if (!canPick) kind = "empty";
  else kind = typing ? "typing" : "listed";
  return { kind, manual, canPick, models };
}

// --- The Draft page's results panel -------------------------------------------

/**
 * - empty: nothing drafted yet.
 * - drafting: a request is in flight; back is what to return to if it fails.
 * - results: drafts are on screen.
 * @typedef {{ kind: "empty" } | { kind: "drafting", back: "empty" | "results" } | { kind: "results" }} DraftPanel
 */

/**
 * - submit: the form was sent.
 * - drafted: the drafts came back.
 * - failed: the request failed.
 * - show: saved drafts were put on screen (Write new drafts on a contact).
 * - clear: nothing to show (a contact with no saved drafts).
 * @typedef {"submit" | "drafted" | "failed" | "show" | "clear"} DraftPanelEvent
 */

/**
 * The panel's next state. An event that makes no sense in the current state leaves it unchanged.
 * While drafting, show and clear only change what a failure goes back to: the spinner stays until the request ends.
 * @param {DraftPanel} panel
 * @param {DraftPanelEvent} event
 * @returns {DraftPanel}
 */
export function draftPanelNext(panel, event) {
  if (panel.kind === "drafting") {
    if (event === "drafted") return { kind: "results" };
    if (event === "failed") return { kind: panel.back };
    if (event === "show") return { kind: "drafting", back: "results" };
    if (event === "clear") return { kind: "drafting", back: "empty" };
    return panel;
  }
  if (event === "submit") return { kind: "drafting", back: panel.kind };
  if (event === "show") return { kind: "results" };
  if (event === "clear") return { kind: "empty" };
  return panel;
}
