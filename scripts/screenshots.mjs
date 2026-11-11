// Takes the README screenshots: starts the app, fills a browser with sample contacts, and saves each page to
// docs/screenshots/. Drafting is answered with sample text, so no API key or model is needed and nothing is sent.
//
//   npm install --no-save playwright && npx playwright install chromium
//   npm run screenshots
//
// Playwright isn't a dependency of the app, so installing it here doesn't change package.json or the lockfile.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Playwright isn't installed. Run: npm install --no-save playwright && npx playwright install chromium");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(root, "docs", "screenshots");
mkdirSync(OUT, { recursive: true });
const PORT = process.env.SCREENSHOT_PORT || "3099";
const BASE = `http://127.0.0.1:${PORT}/`;

const inUse = await fetch(BASE).then(() => true, () => false);
if (inUse) {
  console.error(`Something is already running on port ${PORT}. Stop it or set SCREENSHOT_PORT to a free port.`);
  process.exit(1);
}

// A placeholder key makes the app show Claude as ready. It is never used: /api/drafts is answered below.
const server = spawn(process.execPath, ["server/index.ts"], {
  cwd: root,
  env: { ...process.env, PORT, AI_PROVIDER: "claude", ANTHROPIC_API_KEY: "sk-ant-screenshot-placeholder" },
  stdio: ["ignore", "ignore", "inherit"],
});
for (let i = 0; ; i++) {
  try {
    if ((await fetch(`${BASE}api/model`)).ok) break;
  } catch {}
  if (i > 50) {
    server.kill();
    throw new Error(`The app didn't start on port ${PORT}. Set SCREENSHOT_PORT to a free port.`);
  }
  await new Promise((r) => setTimeout(r, 200));
}

// Sample data: made-up prospects whose sequences started a few days ago, so the Today page has work due.
const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
const CAD = [
  { day: 1, channel: "LinkedIn", action: "Send the connection request" },
  { day: 1, channel: "Email", action: "Send the first email" },
  { day: 3, channel: "Phone", action: "Call; if no answer, leave the voicemail" },
  { day: 5, channel: "Email", action: "Reply in the same thread with one new idea or proof point" },
  { day: 8, channel: "Phone", action: "Call again at a different time of day" },
  { day: 10, channel: "LinkedIn", action: "If connected, send the follow-up message" },
  { day: 14, channel: "Email", action: "Share a short customer example or useful resource" },
  { day: 21, channel: "Email", action: "Send a polite break-up email and ask if you should check back next quarter" },
];
const drafts = {
  websiteHook: "their new Denver distribution center",
  linkedin: {
    connectionNote: "Hi Maya, saw Northwind just opened the Denver distribution center. Congrats. I work with ops leaders scaling new sites and would love to connect.",
    followUpMessage: "Thanks for connecting, Maya. Curious how onboarding has gone for the Denver team so far. A lot of the ops leaders I talk to say the first 90 days of a new site are mostly spreadsheets and phone calls. Is that close to your experience?",
    why: "The note leads with something true about them and asks for nothing, which is why pitch-free connection requests get accepted more often.",
  },
  email: {
    subject: "Denver site ramp",
    body: "Hi Maya,\n\nSaw Northwind opened the Denver distribution center last month. Ramping a new site usually means scheduling lives in spreadsheets for a while.\n\nShiftwise helps ops teams schedule hourly crews in minutes and cut overtime by around 15%. Brightline cut theirs 18% in the first quarter.\n\nWorth a 15-minute look to see if it fits Denver?\n\nCaleb",
    why: "Under 100 words, plain text, one specific detail about them and one low-pressure question.",
  },
  phone: {
    opener: "Hi Maya, it's Caleb from Shiftwise. This is a cold call, so feel free to hang up, but can I have 30 seconds to tell you why I called?",
    discoveryQuestions: [
      "How are you scheduling the Denver crews today?",
      "Where does overtime tend to creep in during a ramp?",
      "If you could fix one thing about shift coverage, what would it be?",
    ],
    voicemail: "Hi Maya, Caleb from Shiftwise. I help ops leaders ramping new sites cut overtime. I'll send a short email with the details. Again, Caleb, Shiftwise.",
    why: "Admitting it's a cold call and asking for 30 seconds keeps the prospect in control, which keeps them on the line.",
  },
  researchToDo: ["Check how many hourly roles the Denver posting lists", "Look for Maya's posts about the new site", "Find who runs scheduling at the Denver site"],
};
function contact(name, title, company, industry, startAgo, doneCount, extra = {}) {
  const sequence = CAD.map((s, i) => (i < doneCount ? { ...s, doneAt: new Date(Date.now() - 86400000 * 2).toISOString() } : { ...s }));
  const at = new Date(Date.now() - startAgo * 86400000).toISOString();
  return {
    id: crypto.randomUUID(), prospectName: name, prospectTitle: title, company, industry, companyWebsite: "", notes: "",
    email: `${name.split(" ")[0].toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, "")}.com`, phone: "(555) 201-4410", linkedinUrl: "",
    createdAt: at, updatedAt: at, status: "active", sequenceStart: daysAgo(startAgo), sequence,
    drafts: [{ id: crypto.randomUUID(), createdAt: at, drafts: JSON.parse(JSON.stringify(drafts).replaceAll("Maya", name.split(" ")[0]).replaceAll("Northwind", company.split(" ")[0]).replaceAll("the Denver team", "the team").replaceAll("a new site are", "a new rollout are")) }],
    activity: [{ at, text: "Saved to contacts" }, { at, text: "Drafts written" }], ...extra,
  };
}
const contacts = [
  contact("Maya Chen", "VP of Operations", "Northwind Logistics", "manufacturing", 4, 2),
  contact("Jordan Ellis", "Director of IT", "Harbor Health", "healthcare", 9, 4),
  contact("Priya Raman", "Head of Sales", "Lumen Software", "software", 13, 5),
  contact("Marcus Webb", "Controller", "Keystone Builders", "construction", 2, 1),
  contact("Elena Ortiz", "Office Manager", "Ortiz Dental", "local", 20, 7, { status: "meeting" }),
  contact("Sam Patel", "CFO", "Bluebird Credit Union", "finance", 25, 8, { status: "replied" }),
];
const seed = { "sdr-outreach:contacts": JSON.stringify({ version: 1, contacts }), "sdr-outreach:yourName": "Caleb", "sdr-outreach:yourOffer": "Shiftwise, scheduling software for hourly crews" };

let browser;
try {
  browser = await chromium.launch();
async function page({ width = 1280, height = 820, dark = false, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: dark ? "dark" : "light", isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, seed);
  const p = await ctx.newPage();
  await p.route("**/api/drafts", (r) => r.fulfill({ json: { ...drafts, cadence: CAD, channelTip: "Mix LinkedIn, email and phone; most replies come after the third to fifth touch." } }));
  return p;
}
const settle = (p) => p.waitForTimeout(700);

let p = await page();
await p.goto(BASE + "#today"); await settle(p);
await p.screenshot({ path: `${OUT}/today.png` });

p = await page();
await p.goto(BASE); await settle(p);
await p.evaluate(() => document.querySelector('[data-view="draft"]').click()); await settle(p);
const fill = async (name, v) => { const el = p.locator(`[name="${name}"]`); if (await el.count()) await el.first().fill(v); };
await fill("prospectName", "Maya Chen"); await fill("prospectTitle", "VP of Operations"); await fill("company", "Northwind Logistics");
await p.selectOption("#industry", "manufacturing").catch(() => {});
await p.click("#submit"); await p.waitForSelector("#results:not([hidden])"); await settle(p);
await p.evaluate(() => scrollTo(0, 0));
await p.screenshot({ path: `${OUT}/draft.png` });

p = await page();
await p.goto(BASE + "#contacts"); await settle(p);
await p.locator("#contact-list li").first().click().catch(() => {}); await settle(p);
await p.screenshot({ path: `${OUT}/contacts.png` });

p = await page();
await p.goto(BASE + "#objections"); await settle(p);
await p.locator("#objection-search").fill("price"); await settle(p);
await p.screenshot({ path: `${OUT}/objections.png` });

p = await page({ dark: true });
await p.goto(BASE + "#today"); await settle(p);
await p.screenshot({ path: `${OUT}/today-dark.png` });

p = await page({ width: 390, height: 844, mobile: true });
await p.goto(BASE + "#today"); await settle(p);
await p.screenshot({ path: `${OUT}/today-phone.png` });
} finally {
  await browser?.close();
  server.kill();
}
console.log(`Saved screenshots to ${path.relative(root, OUT)}/`);
