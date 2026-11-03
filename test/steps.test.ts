import type Anthropic from "@anthropic-ai/sdk";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, test } from "node:test";
import { createApp } from "../server/app.ts";
import { claudeRunner } from "../server/drafts.ts";
import { localRunner } from "../server/local.ts";
import { buildStepPrompt, StepInput, stepJob, type StepDraft } from "../server/steps.ts";

const stepDraft: StepDraft = {
  subject: "Re: Second location",
  message: "Hi Dana, one more thought on the Austin office.",
  voicemail: "",
  talkingPoints: [],
  why: "Adds one new idea instead of checking in.",
};

const body = {
  prospectName: "Dana Lee",
  prospectTitle: "Office Manager",
  company: "Bright Smiles Dental",
  industry: "healthcare",
  notes: "Just opened a second location",
  yourName: "Caleb",
  yourOffer: "Scheduling software that cuts no-shows",
  goal: "Book a 15-minute intro call",
  tone: "friendly",
  step: { day: 8, channel: "Email", action: "Reply in the same thread with a result from a similar practice" },
  touch: 4,
  totalTouches: 7,
  firstTouch: { websiteHook: "second location", emailSubject: "Second location", emailBody: "Hi Dana, congrats on Austin.", linkedinNote: "Hi Dana", voicemail: "Hi Dana, it's Caleb" },
  earlier: [{ day: 4, channel: "Phone", text: "Hi Dana, it's Caleb from Acme." }],
};

let lastParams: Record<string, unknown> | undefined;
const fakeClient = {
  beta: {
    messages: {
      parse: async (params: Record<string, unknown>) => {
        lastParams = params;
        return { stop_reason: "end_turn", parsed_output: stepDraft };
      },
    },
  },
} as unknown as Anthropic;

const neverDrafts = async () => {
  throw new Error("not used");
};

type Server = ReturnType<ReturnType<typeof createApp>["listen"]>;
let server: Server;
let baseUrl: string;
let browserOnly: Server;
let browserOnlyUrl: string;

async function start(app: ReturnType<typeof createApp>): Promise<[Server, string]> {
  const listening = app.listen(0);
  await new Promise((resolve) => listening.once("listening", resolve));
  return [listening, `http://127.0.0.1:${(listening.address() as AddressInfo).port}`];
}

before(async () => {
  const run = claudeRunner(fakeClient);
  [server, baseUrl] = await start(createApp(neverDrafts, undefined, { generateStep: (input) => run(stepJob(input)) }));
  [browserOnly, browserOnlyUrl] = await start(createApp(neverDrafts));
});

after(() => {
  server.close();
  browserOnly.close();
});

function post(url: string, path: string, payload: unknown) {
  return fetch(`${url}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}

test("drafts a follow-up step with the server's model", async () => {
  const response = await post(baseUrl, "/api/steps", body);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), stepDraft);
  const messages = lastParams?.messages as { content: string }[];
  assert.match(messages[0].content, /Write touch 4 of 7: day 8, Email\. The step: Reply in the same thread/);
  assert.match(String(lastParams?.system), /Never write "just checking in"/);
});

test("without a server model, asks the SDR to pick one", async () => {
  const response = await post(browserOnlyUrl, "/api/steps", body);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Pick a model first/);
});

test("asks for the SDR's details when About you is empty", async () => {
  const response = await post(baseUrl, "/api/steps", { ...body, yourName: "" });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Add your name in About you/);
});

test("rejects an unknown channel", async () => {
  const response = await post(baseUrl, "/api/steps", { ...body, step: { ...body.step, channel: "Fax" } });
  assert.equal(response.status, 400);
});

test("builds Claude and local request bodies for the browser, then checks the reply", async () => {
  const prompt = await (await post(browserOnlyUrl, "/api/steps/prompt", body)).json();
  assert.equal(prompt.claude.output_config.format.type, "json_schema");
  assert.ok(prompt.claude.output_config.format.schema.properties.talkingPoints);
  assert.equal(prompt.local.response_format.json_schema.name, "step_draft");
  assert.match(prompt.local.messages[0].content, /must match this JSON schema/);

  const parsed = await post(browserOnlyUrl, "/api/steps/parse", { content: JSON.stringify(stepDraft) });
  assert.deepEqual(await parsed.json(), stepDraft);
  const bad = await post(browserOnlyUrl, "/api/steps/parse", { content: '{"message": 3}' });
  assert.equal(bad.status, 422);
});

test("the prompt carries what was already sent", () => {
  const prompt = buildStepPrompt(StepInput.parse(body));
  assert.match(prompt, /First email subject: Second location/);
  assert.match(prompt, /<email>\nHi Dana, congrats on Austin\.\n<\/email>/);
  assert.match(prompt, /Earlier follow-ups:\nDay 4 Phone: Hi Dana, it's Caleb from Acme\./);
  assert.match(prompt, /Industry playbook \(Healthcare\)/);
});

test("the prompt works with no first-touch drafts", () => {
  const { firstTouch, earlier, ...rest } = body;
  const prompt = buildStepPrompt(StepInput.parse(rest));
  assert.doesNotMatch(prompt, /What was already sent/);
  assert.doesNotMatch(prompt, /Earlier follow-ups/);
});

test("a local model drafts steps with the step schema", async () => {
  const calls: RequestInit[] = [];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    calls.push(init);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(stepDraft) } }] }));
  }) as typeof fetch;
  const run = localRunner({ baseUrl: "http://localhost:11434/v1", model: "gemma4:12b" }, fetchImpl);
  assert.deepEqual(await run(stepJob(StepInput.parse(body)), "step_draft"), stepDraft);
  assert.equal(JSON.parse(calls[0].body as string).response_format.json_schema.name, "step_draft");
});
