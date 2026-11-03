// Model settings: which AI writes the drafts, and the calls to it. With LM Studio, Ollama or an API key
// entered here, the browser talks to the model directly; the app's server only builds the prompt and checks the reply.
import { el } from "./dom.js";

const SETTINGS_KEY = "sdr-outreach:model";
const API_KEY_KEY = "sdr-outreach:anthropic-key";
const ANTHROPIC_URL = "https://api.anthropic.com/v1";
const CLAUDE_MODEL = "claude-opus-5-5";
const BUDGET_MODEL = "claude-haiku-5-5";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

const SERVERS = {
  lmstudio: {
    name: "LM Studio",
    url: "http://localhost:1234/v1",
    notRunning: "Start the server in LM Studio's Developer tab, and in Server Settings switch on Enable CORS.",
  },
  ollama: {
    name: "Ollama",
    url: "http://localhost:11434/v1",
    notRunning: `Make sure Ollama is running. If it is, it may be blocking this page: set the OLLAMA_ORIGINS environment variable to ${location.origin} and restart Ollama.`,
  },
};

// Models that fit each kind of computer, best fit first. Sizes are the 4-bit downloads from the Ollama library
// (October 2026); speeds are rough and vary a lot between machines. Qwen models think before they answer by default,
// which makes a set of drafts slower but often better.
const MODELS = {
  qwen35_4b: { name: "Qwen 3.5 4B", size: "about 3.5 GB", search: "qwen3.5 4b", ollama: "qwen3.5:4b", note: "The strongest small model. Follows the drafting format well for its size." },
  qwen35_9b: { name: "Qwen 3.5 9B", size: "about 6.5 GB", search: "qwen3.5 9b", ollama: "qwen3.5:9b", note: "A strong all-rounder that reads websites and files well." },
  qwen35_35b: { name: "Qwen 3.5 35B A3B", size: "about 22 GB", search: "qwen3.5 35b a3b", ollama: "qwen3.5:35b-a3b", note: "Large but quick: it only uses a small part of the model for each word." },
  qwen38_27b: { name: "Qwen 3.8 27B", size: "about 18 GB", search: "qwen3.8 27b", ollama: "qwen3.8:27b", note: "The newest Qwen and one of the best models you can run at home." },
  gemma4_e2b: { name: "Gemma 4 E2B", size: "about 4.5 GB", search: "gemma 4 e2b", ollama: "gemma4:e2b", note: "Light and quick, with natural-sounding writing." },
  gemma4_e4b: { name: "Gemma 4 E4B", size: "about 6.5 GB", search: "gemma 4 e4b", ollama: "gemma4:e4b", note: "Natural-sounding writing and quicker than Qwen, since it doesn't think first." },
  gemma4_12b: { name: "Gemma 4 12B", size: "about 8 GB", search: "gemma 4 12b", ollama: "gemma4:12b", note: "Solid everyday drafts with natural-sounding writing." },
  gemma4_26b: { name: "Gemma 4 26B A4B", size: "about 17 GB", search: "gemma 4 26b a4b", ollama: "gemma4:26b", note: "The fastest of the big models, since it only uses part of the model for each word." },
  gemma4_31b: { name: "Gemma 4 31B", size: "about 19 GB", search: "gemma 4 31b", ollama: "gemma4:31b", note: "Google's largest Gemma: careful, polished writing, but slower." },
  gptoss_20b: { name: "gpt-oss 20B", size: "about 14 GB", search: "gpt-oss 20b", ollama: "gpt-oss:20b", quant: "the default download", note: "OpenAI's open model. Good quality and quick for its size, but uses almost all of 16 GB." },
  llama32_3b: { name: "Llama 3.2 3B", size: "about 2 GB", search: "llama 3.2 3b instruct", ollama: "llama3.2:3b", note: "The lightest option, for older laptops. Expect plain drafts that need more editing." },
};

const HARDWARE = [
  {
    id: "ram8",
    label: "Laptop or PC with 8 GB of memory and no graphics card",
    models: ["qwen35_4b", "gemma4_e2b", "llama32_3b"],
    speed: "A set of drafts takes roughly one to three minutes.",
  },
  {
    id: "ram16",
    label: "Laptop or PC with 16 GB of memory and no graphics card",
    models: ["qwen35_9b", "gemma4_e4b", "gptoss_20b"],
    speed: "A set of drafts takes roughly two to five minutes on the processor alone.",
  },
  {
    id: "gpu8",
    label: "PC with a graphics card with 6 to 8 GB (NVIDIA or AMD)",
    models: ["qwen35_9b", "gemma4_e4b", "qwen35_4b"],
    speed: "A set of drafts takes under a minute. On a 6 GB card, pick one of the smaller two.",
  },
  {
    id: "gpu12",
    label: "PC with a graphics card with 12 to 16 GB (NVIDIA or AMD)",
    models: ["gemma4_12b", "qwen35_9b", "gptoss_20b"],
    speed: "A set of drafts takes under a minute. gpt-oss 20B needs the full 16 GB.",
  },
  {
    id: "gpu24",
    label: "PC with a graphics card with 24 GB or more",
    models: ["qwen38_27b", "gemma4_26b", "gemma4_31b"],
    speed: "A set of drafts takes well under a minute with Gemma 4 26B A4B, and a minute or so with the others.",
  },
  {
    id: "mac16",
    label: "Mac with Apple silicon and 16 GB of memory",
    models: ["gemma4_12b", "qwen35_9b", "qwen35_4b"],
    speed: "A set of drafts takes about a minute.",
  },
  {
    id: "mac32",
    label: "Mac with Apple silicon and 32 GB of memory or more",
    models: ["qwen38_27b", "gemma4_26b", "qwen35_35b"],
    speed: "A set of drafts takes a minute or two. Gemma 4 26B A4B and Qwen 3.5 35B A3B are the quickest.",
  },
];

/** What the server drafts with from .env (never includes a key), and whether this is the public copy of the app. */
let serverModel = { provider: "claude", hasApiKey: false, hosted: false, maxFileBytes: 10 * 1024 * 1024 };
let settings = null;

// --- Storage -----------------------------------------------------------------

function read(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function write(storage, key, value) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private mode); settings then last until the page is closed.
  }
}

function defaults() {
  const servers = Object.fromEntries(Object.entries(SERVERS).map(([id, server]) => [id, { url: server.url, model: "" }]));
  let provider = "claude";
  if (serverModel.provider === "local") {
    provider = serverModel.baseUrl.includes(":1234") ? "lmstudio" : "ollama";
    servers[provider] = { url: serverModel.baseUrl, model: serverModel.model };
  }
  return { provider, budget: false, hardware: "gpu12", servers };
}

function loadSettings() {
  const base = defaults();
  try {
    const saved = JSON.parse(read(localStorage, SETTINGS_KEY) ?? "null");
    if (!saved || typeof saved !== "object") return base;
    return {
      provider: ["claude", "lmstudio", "ollama"].includes(saved.provider) ? saved.provider : base.provider,
      budget: saved.budget === true,
      hardware: HARDWARE.some((h) => h.id === saved.hardware) ? saved.hardware : base.hardware,
      servers: Object.fromEntries(
        Object.keys(SERVERS).map((id) => {
          const server = saved.servers?.[id] ?? {};
          return [id, { url: String(server.url ?? base.servers[id].url), model: String(server.model ?? base.servers[id].model) }];
        }),
      ),
    };
  } catch {
    return base;
  }
}

/** Saves everything except the API key, which has its own storage rules below. */
function saveSettings() {
  write(localStorage, SETTINGS_KEY, JSON.stringify(settings));
}

/** The key lives in this tab's session storage, or in local storage only if the user asked to remember it. */
function apiKey() {
  return (read(sessionStorage, API_KEY_KEY) ?? read(localStorage, API_KEY_KEY) ?? "").trim();
}

function keyIsRemembered() {
  return read(localStorage, API_KEY_KEY) !== null;
}

function storeApiKey(key, remember) {
  const value = key.trim() || null;
  write(sessionStorage, API_KEY_KEY, value);
  // Not remembering means no copy outlives the tab, including one saved earlier.
  write(localStorage, API_KEY_KEY, remember ? value : null);
}

// --- Checking settings -------------------------------------------------------

function serverUrl(provider) {
  return settings.servers[provider].url.trim().replace(/\/+$/, "");
}

/** Why this address can't be used, or "" if it can. The page may only talk to servers on this computer. */
function urlProblem(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return "Enter the full address, like http://localhost:1234/v1.";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "The address has to start with http://.";
  if (!LOCAL_HOSTS.has(parsed.hostname)) {
    return "For your privacy, this page only connects to model servers on this computer (localhost or 127.0.0.1).";
  }
  if (parsed.username || parsed.password) return "Leave the user name and password out of the address.";
  return "";
}

function keyProblem(key) {
  if (!key) return "";
  return /^sk-ant-[\w-]+$/.test(key) ? "" : "That doesn't look like an Anthropic API key. Keys start with sk-ant-.";
}

function claudeModel() {
  return settings.budget ? BUDGET_MODEL : CLAUDE_MODEL;
}

// --- Calling the models ------------------------------------------------------

async function json(response) {
  return response.json().catch(() => ({}));
}

async function post(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await json(response);
  if (!response.ok) throw new Error(data.error ?? "Something went wrong.");
  return data;
}

function anthropicHeaders(key) {
  return {
    "content-type": "application/json",
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
    // Anthropic asks browser callers to opt in, since a key in a web page can be read by that page.
    // This page is served from your own computer and loads no outside scripts, so the key stays with you.
    "anthropic-dangerous-direct-browser-access": "true",
  };
}

function anthropicError(status, data) {
  if (status === 401) return "Anthropic didn't accept that API key. Check it on the Model settings page.";
  if (status === 403) return "That API key isn't allowed to use this model. Check its permissions at console.anthropic.com.";
  if (status === 429) return "Too many requests right now, or your account hit its spending limit. Wait a minute and try again.";
  if (status === 529 || status >= 500) return "Anthropic is busy right now. Try again in a minute.";
  return `Anthropic returned an error (${status}): ${data.error?.message ?? "unknown error"}`;
}

const anthropicRequest = { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" };

async function draftWithClaude(prompt, key) {
  const budget = settings.budget;
  const headers = anthropicHeaders(key);
  // Opus can hand a declined request to another model; Haiku has no fallback.
  if (!budget) headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
  let response;
  try {
    response = await fetch(`${ANTHROPIC_URL}/messages`, {
      ...anthropicRequest,
      method: "POST",
      headers,
      body: JSON.stringify({ model: claudeModel(), ...prompt.claude, ...(budget ? {} : { fallbacks: "default" }) }),
    });
  } catch {
    throw new Error("Couldn't reach Anthropic. Check your internet connection and try again.");
  }
  const data = await json(response);
  if (!response.ok) throw new Error(anthropicError(response.status, data));
  if (data.stop_reason === "refusal") throw new Error("Claude declined to write this outreach. Try rewording the notes or offer.");
  if (data.stop_reason === "max_tokens") throw new Error("Claude's reply was cut off. Try again.");
  const text = (data.content ?? []).find((block) => block.type === "text")?.text;
  if (!text) throw new Error("Claude returned no drafts. Try again.");
  return text;
}

async function draftWithLocal(prompt, provider) {
  const server = SERVERS[provider];
  const url = serverUrl(provider);
  const model = settings.servers[provider].model.trim();
  const problem = urlProblem(url);
  if (problem) throw new Error(problem);
  if (!model) throw new Error(`Pick a model on the Model settings page first.`);

  let response;
  try {
    response = await fetch(`${url}/chat/completions`, {
      method: "POST",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, ...prompt.local }),
    });
  } catch {
    setStatus("error", `Can't reach ${server.name}`);
    throw new Error(`Couldn't reach ${server.name} at ${url}. ${server.notRunning}`);
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    if (/context|n_ctx|too long|tokens? (?:exceed|limit)/i.test(detail)) {
      throw new Error(`The prompt is too long for the model's context length. Reload the model with Context Length set to at least 8192, or leave out the file.`);
    }
    if (response.status === 404 || /model/i.test(detail)) {
      const fix = provider === "ollama" ? ` Download it with: ollama pull ${model}` : " Check the name with Test connection on the Model settings page.";
      throw new Error(`${server.name} doesn't have the model "${model}".${fix}`);
    }
    throw new Error(`${server.name} returned an error (${response.status}): ${detail}`);
  }
  const data = await json(response);
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${server.name}'s reply was empty. Try again, or switch to a larger model.`);
  return text;
}

/** Drafts outreach with whichever model is chosen. Returns what /api/drafts returns. */
export async function requestDrafts(data) {
  const key = apiKey();
  if (needsSetup()) throw new Error("Pick a model first: open Model settings and add your Anthropic API key, or choose LM Studio or Ollama.");
  // Claude without a key here uses the server's own setup from .env.
  if (settings.provider === "claude" && !key) return post("/api/drafts", data);

  const prompt = await post("/api/drafts/prompt", data);
  const content = settings.provider === "claude" ? await draftWithClaude(prompt, key) : await draftWithLocal(prompt, settings.provider);
  const drafts = await post("/api/drafts/parse", { industry: data.industry, content });
  return { ...drafts, websiteNote: prompt.websiteNote, attachmentNote: prompt.attachmentNote };
}

/** Drafts one follow-up step (see server/steps.ts) with whichever model is chosen. Returns what /api/steps returns. */
export async function requestStepDraft(data) {
  const key = apiKey();
  if (needsSetup()) throw new Error("Pick a model first: open Model settings and add your Anthropic API key, or choose LM Studio or Ollama.");
  if (settings.provider === "claude" && !key) return post("/api/steps", data);

  const prompt = await post("/api/steps/prompt", data);
  const content = settings.provider === "claude" ? await draftWithClaude(prompt, key) : await draftWithLocal(prompt, settings.provider);
  return post("/api/steps/parse", { content });
}

/** Text for the loading screen. */
export function draftingWith() {
  if (settings.provider === "claude") {
    if (!apiKey() && serverModel.provider === "local") return serverModel.model;
    return settings.budget && apiKey() ? "Claude Haiku" : "Claude";
  }
  return `${settings.servers[settings.provider].model || "your local model"} in ${SERVERS[settings.provider].name}`;
}

// --- Testing the connection --------------------------------------------------

async function testClaude() {
  const key = apiKey();
  if (!key) {
    if (serverModel.provider === "local") return { ok: true, text: `No key entered here, so drafts use ${serverModel.model} from your .env file.` };
    if (serverModel.hasApiKey) return { ok: true, text: "No key entered here, so drafts use the API key in your .env file." };
    return { ok: false, text: "Enter your Anthropic API key first." };
  }
  const problem = keyProblem(key);
  if (problem) return { ok: false, text: problem };
  let response;
  try {
    // Looking up the model checks the key without spending anything.
    response = await fetch(`${ANTHROPIC_URL}/models/${claudeModel()}`, { ...anthropicRequest, headers: anthropicHeaders(key) });
  } catch {
    return { ok: false, text: "Couldn't reach Anthropic. Check your internet connection." };
  }
  if (!response.ok) return { ok: false, text: anthropicError(response.status, await json(response)) };
  return { ok: true, text: `Connected. Your key works with ${claudeModel()}.` };
}

// What each local server said it has: null until asked, then { models, error }. error is set when it couldn't be asked.
const detected = { lmstudio: null, ollama: null };
// Bumped on every lookup so an older, slower answer can't overwrite a newer one.
const lookups = { lmstudio: 0, ollama: 0 };

/** Asks a local server which models it has downloaded. LM Studio and Ollama both answer GET /v1/models. */
async function detectModels(provider) {
  const server = SERVERS[provider];
  const url = serverUrl(provider);
  const problem = urlProblem(url);
  if (problem) return { models: [], error: problem };
  try {
    const response = await fetch(`${url}/models`, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
    if (!response.ok) return { models: [], error: `${server.name} answered with an error (${response.status}). Check the address ends in /v1.` };
    // Embedding models can't write drafts, so they're left out of the list.
    const ids = ((await json(response)).data ?? []).map((m) => String(m?.id ?? "")).filter((id) => id && !/embed/i.test(id));
    return { models: [...new Set(ids)].sort((a, b) => a.localeCompare(b)), error: "" };
  } catch {
    return { models: [], error: `Couldn't reach ${server.name} at ${url}. ${server.notRunning}` };
  }
}

async function testLocal(provider) {
  const server = SERVERS[provider];
  const lookup = ++lookups[provider];
  if (settings.provider === provider) renderModelPicker();
  const found = await detectModels(provider);
  if (lookup !== lookups[provider]) return { ok: false, stale: true, text: "" };
  detected[provider] = found;

  const { models, error } = found;
  const chosen = settings.servers[provider];
  if (!error && models.length > 0 && !chosen.model.trim()) {
    chosen.model = models[0];
    saveSettings();
  }
  if (settings.provider === provider) renderModelPicker();

  if (error) return { ok: false, text: error };
  if (models.length === 0) {
    const fix = provider === "ollama" ? "Download one with ollama pull (see the suggestion above)." : "Download one in LM Studio's Discover tab.";
    return { ok: false, text: `Connected to ${server.name}, but it has no models yet. ${fix}` };
  }
  if (!models.includes(chosen.model.trim())) {
    return { ok: false, text: `Connected to ${server.name}, but it doesn't have "${chosen.model}". Pick one from the Model list.` };
  }
  return { ok: true, text: `Connected to ${server.name}. Drafts will use ${chosen.model}.` };
}

function testConnection() {
  return settings.provider === "claude" ? testClaude() : testLocal(settings.provider);
}

// --- The settings page -------------------------------------------------------

const form = document.getElementById("model-form");
const keyInput = document.getElementById("api-key");
const rememberBox = document.getElementById("remember-key");
const urlInput = document.getElementById("server-url");
const modelSelect = document.getElementById("model-select");
const modelInput = document.getElementById("model-name");
const modelHelp = document.getElementById("model-help");
const modelMode = document.getElementById("model-mode");
const refreshButton = document.getElementById("refresh-models");
const hardwareSelect = document.getElementById("hardware");
const statusLine = document.getElementById("connection-status");

function setStatus(state, text) {
  const dot = document.getElementById("model-dot");
  dot.className = `model-dot ${state}`;
  dot.parentElement.title = text;
}

function showResult(result) {
  statusLine.textContent = result.text;
  statusLine.className = result.ok ? "good" : "error";
  setStatus(result.ok ? "ok" : "error", result.ok ? summary() : result.text);
}

function summary() {
  if (settings.provider === "claude") return needsSetup() ? "No Anthropic API key yet" : `Drafting with ${draftingWith()}`;
  return `Drafting with ${draftingWith()}`;
}

function code(text) {
  return el("code", "", text);
}

// Which of a tier's models is shown; goes back to the best fit when the tier changes.
let suggestion = 0;

function renderRecommendation() {
  const tier = HARDWARE.find((h) => h.id === settings.hardware) ?? HARDWARE[0];
  const pick = MODELS[tier.models[suggestion] ?? tier.models[0]];
  const box = document.getElementById("recommendation");

  const choices = el("div", "model-choices");
  choices.setAttribute("role", "group");
  choices.setAttribute("aria-label", "Suggested models");
  tier.models.forEach((id, index) => {
    const button = el("button", "model-choice", MODELS[id].name);
    button.type = "button";
    button.setAttribute("aria-pressed", String(MODELS[id] === pick));
    if (index === 0) button.append(el("span", "best", "Best fit"));
    button.addEventListener("click", () => {
      suggestion = index;
      renderRecommendation();
    });
    choices.append(button);
  });

  const how = el("p");
  if (settings.provider === "ollama") {
    how.append(`Download ${pick.name} (${pick.size}). In a terminal, run `, code(`ollama pull ${pick.ollama}`), ".");
  } else {
    const quant = pick.quant ?? "the Q4_K_M version (or MLX 4-bit on a Mac)";
    how.append(
      `Download ${pick.name} (${pick.size}). In LM Studio's Discover tab, search `,
      code(pick.search),
      ` and pick ${quant}. When you load it, set Context Length to at least 8192.`,
    );
  }
  const actions = el("p");
  if (settings.provider === "ollama") {
    const use = el("button", "link-button", `Use ${pick.ollama}`);
    use.type = "button";
    use.addEventListener("click", () => {
      onChange(() => (settings.servers.ollama.model = pick.ollama));
      renderModelPicker();
    });
    actions.append(use);
  } else {
    actions.className = "muted";
    actions.textContent = "Then press Refresh list and pick it from the Model list below.";
  }
  box.replaceChildren(choices, el("p", "", pick.note), how, el("p", "muted", tier.speed), actions);
}

// True when the user chose to type a model name rather than pick one the server listed.
let typing = false;

function option(value, text, { disabled = false } = {}) {
  const node = new Option(text, value);
  node.disabled = disabled;
  return node;
}

/** The Model field: a list of the models the server has, or a text box when it can't list them or the user asked to type. */
function renderModelPicker() {
  const provider = settings.provider;
  if (provider === "claude") return;
  const server = SERVERS[provider];
  const found = detected[provider];
  const saved = settings.servers[provider].model.trim();
  const checking = lookups[provider] > 0 && (found === null || refreshButton.disabled);
  const models = found?.models ?? [];
  const canPick = models.length > 0;
  const manual = typing || (found !== null && !canPick);

  modelSelect.hidden = manual;
  modelInput.hidden = !manual;
  modelMode.hidden = manual ? !canPick : false;
  modelMode.textContent = manual ? "Pick from the models found instead" : "Type a model name instead";
  modelInput.placeholder = provider === "ollama" ? "gemma4:12b" : "google/gemma-4-12b";
  if (document.activeElement !== modelInput) modelInput.value = saved;

  const options = [];
  if (!found) {
    options.push(saved ? option(saved, saved) : option("", checking ? "Looking for models..." : "No models found yet", { disabled: true }));
  } else {
    if (!saved) options.push(option("", "Pick a model", { disabled: true }));
    if (saved && !models.includes(saved)) options.push(option(saved, `${saved} (not found in ${server.name})`));
    options.push(...models.map((id) => option(id, id)));
  }
  modelSelect.replaceChildren(...options);
  modelSelect.value = saved;

  const typeHint = provider === "lmstudio" ? "the model's identifier from LM Studio's Developer tab" : "the name you pulled, like gemma4:12b";
  if (checking) {
    modelHelp.textContent = `Looking for the models you've downloaded in ${server.name}...`;
  } else if (found?.error) {
    modelHelp.textContent = `Couldn't list ${server.name}'s models. Type ${typeHint}, or fix the connection above and press Refresh list.`;
  } else if (found && !canPick) {
    modelHelp.textContent = `${server.name} has no models yet. Download one, then press Refresh list, or type ${typeHint}.`;
  } else if (manual) {
    modelHelp.textContent = `Type ${typeHint}.`;
  } else if (found) {
    const count = models.length === 1 ? "1 model" : `${models.length} models`;
    modelHelp.textContent = `${count} found in ${server.name}. Downloaded a new one? Press Refresh list.`;
  } else {
    modelHelp.textContent = `Press Refresh list to see the models you've downloaded in ${server.name}.`;
  }
}

function renderForm() {
  const provider = settings.provider;
  for (const radio of form.elements.provider) {
    radio.checked = radio.value === provider;
    radio.closest(".choice").classList.toggle("selected", radio.checked);
  }
  const local = provider !== "claude";
  document.getElementById("claude-settings").hidden = local;
  document.getElementById("local-settings").hidden = !local;
  document.getElementById("budget-mode").checked = settings.budget;

  const serverKey = document.getElementById("server-key-note");
  serverKey.textContent =
    serverModel.provider === "local"
      ? `Leave it empty to draft with your .env setup instead (${serverModel.model} at ${serverModel.baseUrl}, through the app's server).`
      : serverModel.hasApiKey
        ? "Leave it empty to use the key in your .env file instead (Budget mode then doesn't apply)."
        : "";

  if (local) {
    const server = SERVERS[provider];
    urlInput.value = settings.servers[provider].url;
    urlInput.placeholder = server.url;
    typing = false;
    const help = document.getElementById("server-url-help");
    help.textContent =
      provider === "lmstudio"
        ? `The default (${server.url}) works unless you changed the port in LM Studio. In LM Studio, open the Developer tab, start the server, click Server Settings and switch on Enable CORS. Without it, this page can't connect.`
        : `The default (${server.url}) works unless you changed Ollama's port. Ollama starts its server by itself once it's installed.`;
    if (serverModel.hosted) {
      help.textContent += " Your browser may ask whether this site can use devices on your local network: allow it, so the page can reach the model on your computer. Chrome and Edge work best.";
    }
    renderModelPicker();
    renderRecommendation();
  }
  statusLine.textContent = "";
  statusLine.className = "";
}

function onChange(update) {
  update();
  saveSettings();
  statusLine.textContent = "";
  setStatus("unknown", summary());
}

hardwareSelect.replaceChildren(...HARDWARE.map((h) => new Option(h.label, h.id)));

form.addEventListener("submit", (event) => event.preventDefault());
for (const radio of form.querySelectorAll('input[name="provider"]')) {
  radio.addEventListener("change", () => {
    onChange(() => (settings.provider = radio.value));
    renderForm();
    if (settings.provider !== "claude") checkQuietly();
  });
}
keyInput.addEventListener("input", () => {
  storeApiKey(keyInput.value, rememberBox.checked);
  const problem = keyProblem(keyInput.value.trim());
  statusLine.textContent = problem;
  statusLine.className = problem ? "error" : "";
  setStatus("unknown", summary());
});
rememberBox.addEventListener("change", () => storeApiKey(keyInput.value, rememberBox.checked));
document.getElementById("budget-mode").addEventListener("change", (event) => onChange(() => (settings.budget = event.target.checked)));
urlInput.addEventListener("input", () => onChange(() => (settings.servers[settings.provider].url = urlInput.value)));
urlInput.addEventListener("change", () => {
  const problem = urlProblem(serverUrl(settings.provider));
  statusLine.textContent = problem;
  statusLine.className = problem ? "error" : "";
  // A new address may be a different server with different models.
  if (!problem) refreshModels();
});
modelInput.addEventListener("input", () => onChange(() => (settings.servers[settings.provider].model = modelInput.value)));
modelInput.addEventListener("change", () => renderModelPicker());
modelSelect.addEventListener("change", () => onChange(() => (settings.servers[settings.provider].model = modelSelect.value)));
modelMode.addEventListener("click", () => {
  typing = modelInput.hidden;
  renderModelPicker();
  (typing ? modelInput : modelSelect).focus();
});

/** Asks the server for its models again and shows what it said. */
async function refreshModels() {
  if (settings.provider === "claude") return;
  refreshButton.disabled = true;
  refreshButton.textContent = "Refreshing...";
  statusLine.className = "";
  statusLine.textContent = "";
  try {
    const result = await testLocal(settings.provider);
    if (!result.stale) showResult(result);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh list";
    renderModelPicker();
  }
}
refreshButton.addEventListener("click", refreshModels);
hardwareSelect.addEventListener("change", () => {
  onChange(() => (settings.hardware = hardwareSelect.value));
  suggestion = 0;
  renderRecommendation();
});

const testButton = document.getElementById("test-connection");
testButton.addEventListener("click", async () => {
  testButton.disabled = true;
  statusLine.className = "";
  statusLine.textContent = "Checking...";
  try {
    const result = await testConnection();
    if (!result.stale) showResult(result);
  } finally {
    testButton.disabled = false;
  }
});

/** Checks a local server in the background so the dot in the menu shows whether it's ready. */
async function checkQuietly() {
  if (settings.provider === "claude") {
    setStatus(needsSetup() ? "error" : "ok", summary());
    return;
  }
  const result = await testLocal(settings.provider);
  if (result.stale) return;
  setStatus(result.ok ? "ok" : "error", result.ok ? summary() : result.text);
  // Show what went wrong if the settings page is open.
  if (!document.getElementById("model-view").hidden) showResult(result);
}

/** The largest file this copy of the app accepts. A public copy takes smaller ones. */
export function maxFileBytes() {
  return serverModel.maxFileBytes ?? 10 * 1024 * 1024;
}

export async function initModelSettings() {
  try {
    const response = await fetch("/api/model");
    if (response.ok) serverModel = { ...serverModel, ...(await response.json()) };
  } catch {
    // An older server: keep the defaults.
  }
  settings = loadSettings();
  keyInput.value = apiKey();
  rememberBox.checked = keyIsRemembered();
  hardwareSelect.value = settings.hardware;
  renderForm();
  await checkQuietly();
}

/** True when nothing can draft yet, so the Draft view can point to the settings page. */
export function needsSetup() {
  return settings.provider === "claude" && !apiKey() && !serverCanDraft();
}

/** Whether /api/drafts works without a key from this page: a key in .env, or AI_PROVIDER=local. */
function serverCanDraft() {
  return serverModel.provider === "local" || serverModel.hasApiKey;
}
