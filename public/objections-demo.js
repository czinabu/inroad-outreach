// Default objection library: the objections B2B SDRs hear most on cold calls
// and in email replies. Generic, original wording with no company names, so
// the tool can be shown publicly. Load your own set with "Load a set" on the
// Objections page; it's saved in your browser only.
//
// Library shape:
//   modes        the two call types: { inside: {name, hint}, field: {name, hint} }
//                "inside" ends in a live transfer, "field" ends in a booked appointment.
//   groups       section names, in display order
//   objections   list of:
//     id         unique slug
//     title      what the prospect says (shown on the button)
//     group      one of groups
//     keywords   words a rep might type to find it
//     rebuttals  list of { text, mode?, note? }; mode is "inside" or "field",
//                leave it off when the line works for both
//     probe      optional question-first flow: { ask, answers: [{ label, text, coach? }] }
//     cue        optional one line to glance at instead of the full rebuttal;
//                if left off, the first sentence of the rebuttal is used
//     note       optional reminder shown above the rebuttals
//     forceMode  optional: always use this call type's close
//   transitions  closing scripts per mode: { label, close, confirm?, assumptive: [] }
//
// Text in [square brackets] is highlighted as a blank to fill in.

export const DEMO_LIBRARY = {
  version: 1,
  name: "SDR starter set",
  // Quick picks: what 1–9 open before you type anything.
  pins: ["not-interested", "send-info", "competitor", "busy", "not-right-time", "no-budget", "not-decision-maker", "happy-as-is", "think-about-it"],
  modes: {
    inside: { name: "Live transfer", hint: "warm handoff to an AE" },
    field: { name: "Book a meeting", hint: "calendar invite" },
  },
  groups: ["Brush-offs", "Budget and value", "Timing and priority", "Decision makers", "Competition and status quo"],
  objections: [
    // ------------------------------------------------------------ Brush-offs
    {
      id: "not-interested",
      title: "Not interested",
      group: "Brush-offs",
      cue: "Ask why before you accept it: covered already, or not a priority?",
      keywords: ["not interested", "interested", "no thanks", "no thank you", "pass", "nope", "im good", "all set"],
      probe: {
        ask: "Totally fair. Is that because you've already got this covered, or because it's just not a priority right now?",
        answers: [
          { label: "Covered", text: "Makes sense. Most teams I talk to have something in place. Out of curiosity, what are you using today, and how's it working?", coach: "Then open the \"We already use someone\" card." },
          { label: "Not a priority", text: "Understood. What is the priority for your team this quarter? If this doesn't connect to it, I'll get out of your way." },
          { label: "Just no", text: "No problem. Can I ask one question before I go: how are you handling [the problem you solve] today?" },
        ],
      },
      rebuttals: [
        { text: "Fair enough, I called out of the blue. Can I take thirty seconds to tell you why I called, and then you can tell me if it's worth another minute?" },
        { text: "I hear that a lot before people know what this is. Teams like [similar company] said the same, and they ended up [result]. Would it hurt to see how?" },
      ],
    },
    {
      id: "send-info",
      title: "Just send me an email",
      group: "Brush-offs",
      cue: "Happy to. Ask one question so what you send is worth opening.",
      keywords: ["send", "email", "mail", "info", "information", "deck", "brochure", "website", "linkedin"],
      rebuttals: [
        { text: "Happy to. So I don't send you something generic, what's the biggest headache with [the problem you solve] right now?" },
        { text: "Sure. Most people tell me that and the email gets buried. How about I send it now and we put fifteen minutes on the calendar to go through it together? You can always cancel." },
      ],
    },
    {
      id: "busy",
      title: "I'm busy / bad time",
      group: "Brush-offs",
      cue: "Ask for thirty seconds, or book the callback right now.",
      keywords: ["busy", "bad time", "cant talk", "in a meeting", "call back", "call me later", "driving", "swamped"],
      rebuttals: [
        { text: "I'll be quick. Give me thirty seconds for why I called, and if it's not relevant you can hang up on me." },
        { text: "Totally understand. Rather than chase you, can we pick a time? Does [day] at [time] or [time] work better for a ten-minute call?" },
      ],
    },
    {
      id: "how-did-you-get-my-number",
      title: "How did you get my info?",
      group: "Brush-offs",
      cue: "Be honest about the source, then give the reason you reached out to them.",
      keywords: ["number", "how did you get", "who gave you", "where did you get", "my info", "list", "spam", "who is this"],
      rebuttals: [
        { text: "Fair question. I found you through [source], and I reached out because you're the [title] at [company] and we work with a lot of teams like yours on [the problem you solve]." },
        { text: "Good question. If you'd rather I didn't reach out again, I'll take you off my list right now. Before I do, is [the problem you solve] something on your plate at all?" },
      ],
    },
    {
      id: "sales-call",
      title: "Is this a sales call?",
      group: "Brush-offs",
      cue: "Own it with a smile. Then ask permission for thirty seconds.",
      keywords: ["sales call", "selling", "sales pitch", "pitch", "cold call", "telemarketer", "salesperson"],
      rebuttals: [
        { text: "It is, and I'll be upfront about it. Can I have thirty seconds to tell you why I called you specifically? Then you can decide if we keep talking." },
        { text: "Guilty. Honestly, though, I'm not trying to sell you anything today. I just want to find out if [the problem you solve] is even an issue for you." },
      ],
    },

    // -------------------------------------------------------- Budget and value
    {
      id: "no-budget",
      title: "We don't have budget",
      group: "Budget and value",
      cue: "Today's meeting costs nothing. Find out when budget gets set.",
      keywords: ["budget", "no budget", "money", "funding", "cost", "afford", "spend", "frozen", "cuts"],
      probe: {
        ask: "Understood. Is it that there's no budget this year, or no budget for this specifically?",
        answers: [
          { label: "This year", text: "Makes sense. When does planning for next year start? It's worth seeing this before then so you have the numbers ready." },
          { label: "For this", text: "Got it. Most of our customers didn't have a line item either. They paid for it out of what it saved on [cost it replaces]." },
        ],
      },
      rebuttals: [
        { text: "Totally fair, and I'm not asking you to buy anything. This first call is just to see whether there's enough value here to be worth budgeting for." },
        { text: "That's common. Most teams we work with found the budget once they saw it save [result]. Worth twenty minutes to see if the math works for you?" },
      ],
    },
    {
      id: "too-expensive",
      title: "It's too expensive",
      group: "Budget and value",
      cue: "Expensive compared to what? Steer to the cost of the problem.",
      keywords: ["expensive", "price", "pricey", "cost too much", "too much", "cheaper", "pricing", "discount"],
      rebuttals: [
        { text: "I hear you. Compared to what, though? What is [the problem you solve] costing you today in time or lost deals?" },
        { text: "Fair. Pricing depends a lot on how you'd use it, so the AE can put real numbers in front of you instead of a list price. Worth a look?" },
      ],
    },
    {
      id: "no-need",
      title: "We don't need it",
      group: "Budget and value",
      cue: "Maybe so. Ask one question that tests it.",
      keywords: ["dont need", "no need", "not needed", "fine without", "doesnt apply", "not relevant", "not a fit", "no use"],
      rebuttals: [
        { text: "You might be right. Can I ask how you're handling [the problem you solve] today? If it's working, I'll tell you we're not a fit." },
        { text: "Fair. A lot of [title]s told me the same, until they noticed [pain point]. Is that something you ever run into?" },
      ],
    },

    // ----------------------------------------------------- Timing and priority
    {
      id: "not-right-time",
      title: "Reach out next quarter",
      group: "Timing and priority",
      cue: "Find out what changes then, and lock in the follow-up now.",
      keywords: ["next quarter", "next year", "later", "timing", "not now", "reach out", "few months", "q1", "q2", "q3", "q4", "after"],
      rebuttals: [
        { text: "Happy to. Just so I'm calling at the right moment, what changes next quarter that makes it a better time?" },
        { text: "Sounds good. Let's put a short call on the calendar for [date] now, so neither of us has to remember. If things change, you can just move it." },
      ],
    },
    {
      id: "not-a-priority",
      title: "Not a priority right now",
      group: "Timing and priority",
      cue: "Ask what is the priority, and connect to it if you honestly can.",
      keywords: ["priority", "priorities", "other things", "focused on", "bigger fish", "back burner", "on hold", "too much going on"],
      rebuttals: [
        { text: "Understood. What is at the top of the list for your team right now? If this doesn't connect to it, I won't waste your time." },
        { text: "Makes sense. Most teams we work with weren't prioritizing it either, until they saw it was quietly costing them [result]. Worth twenty minutes to find out if that's true for you?" },
      ],
    },
    {
      id: "think-about-it",
      title: "I need to think about it",
      group: "Timing and priority",
      cue: "Ask what they'd want to think through, then set the next step.",
      keywords: ["think", "think about it", "consider", "sleep on it", "mull", "not sure", "get back to you"],
      rebuttals: [
        { text: "Of course. What's the main thing you'd want to think through? Maybe I can answer it right now." },
        { text: "Makes sense. Let's put fifteen minutes on the calendar for later this week, so you have time to think and a set time to ask questions." },
      ],
    },

    // -------------------------------------------------------- Decision makers
    {
      id: "not-decision-maker",
      title: "I'm not the right person",
      group: "Decision makers",
      cue: "Ask who is, and whether they'll introduce you.",
      keywords: ["not the right person", "wrong person", "not my decision", "decision maker", "not me", "someone else", "boss", "manager", "who handles"],
      rebuttals: [
        { text: "Thanks for telling me. Who would be the best person to talk to about [the problem you solve]? Would it be okay if I mention you pointed me their way?" },
        { text: "No problem. Even if you don't sign off on it, you'd probably use it day to day. Would you be open to joining the call with [decision maker]?" },
      ],
    },
    {
      id: "run-it-by-team",
      title: "I have to run it by my team",
      group: "Decision makers",
      cue: "Great, bring them in. Book the meeting with the team on it.",
      keywords: ["team", "run it by", "check with", "boss", "partner", "committee", "procurement", "legal", "talk to my"],
      rebuttals: [
        { text: "That makes sense. Who else would need to be involved? Let's get a time when they can join, so they hear it firsthand instead of secondhand." },
        { text: "Totally. What do you think they'll want to know? I'll make sure the AE comes ready to answer it." },
      ],
    },

    // --------------------------------------------- Competition and status quo
    {
      id: "competitor",
      title: "We already use someone",
      group: "Competition and status quo",
      cue: "Great, they know the problem. Ask what they'd change.",
      keywords: ["competitor", "already use", "already have", "using", "vendor", "another company", "someone else", "provider", "tool"],
      rebuttals: [
        { text: "Good to hear, so you already know the problem is worth solving. What do you like about them, and is there anything you wish worked better?" },
        { text: "Makes sense. A lot of our customers switched from [competitor] because of [differentiator]. Worth a quick side-by-side before your next renewal?" },
      ],
    },
    {
      id: "happy-as-is",
      title: "We're happy with how things are",
      group: "Competition and status quo",
      cue: "Not asking them to change. Just a benchmark to compare against.",
      keywords: ["happy", "fine", "works for us", "status quo", "good as is", "no problems", "doing ok", "satisfied"],
      rebuttals: [
        { text: "Glad to hear it, and I'm not asking you to change anything. Most of our customers were happy too. They just wanted to see if they were leaving [result] on the table." },
        { text: "That's great. If you could change one thing about how you handle [the problem you solve] today, what would it be?" },
      ],
    },
    {
      id: "in-house",
      title: "We built something in-house",
      group: "Competition and status quo",
      cue: "Respect it. Ask what it costs to keep it running.",
      keywords: ["in house", "in-house", "built it", "our own", "homegrown", "internal tool", "spreadsheet", "engineers"],
      rebuttals: [
        { text: "Impressive, that's not easy. How much of your team's time goes into keeping it running? Many customers came to us to give that time back." },
        { text: "Makes sense. Is it doing everything you hoped when you built it, or is there a wishlist that never gets prioritized?" },
      ],
    },
    {
      id: "under-contract",
      title: "We're locked into a contract",
      group: "Competition and status quo",
      cue: "Ask when it renews. Get on the calendar before then.",
      keywords: ["contract", "locked in", "signed", "renewal", "agreement", "committed", "multi year", "term"],
      rebuttals: [
        { text: "Understood. When does it come up for renewal? Teams usually start comparing options three to six months before, so you have leverage when it does." },
        { text: "Totally fair. A short look now costs nothing, and you'll know whether it's worth switching when the time comes." },
      ],
    },
    {
      id: "tried-before",
      title: "We tried something like this before",
      group: "Competition and status quo",
      cue: "Ask what went wrong. That's your opening.",
      keywords: ["tried", "tried before", "didnt work", "bad experience", "burned", "last time", "failed"],
      rebuttals: [
        { text: "Sorry to hear that. What didn't work about it? If we'd have the same problem, I'll tell you." },
        { text: "That's useful to know. A lot of our customers had been burned before too, which is why we [differentiator]. Worth twenty minutes to see the difference?" },
      ],
    },
  ],
  transitions: {
    inside: {
      label: "Warm transfer to an account executive",
      close: "My colleague [AE name] handles these conversations and is free right now. Can I bring them on for ten minutes so you get your questions answered while we're both here?",
      assumptive: [
        "Great, give me ten seconds to bring [AE name] on.",
        "That's a great question for [AE name]. Hang on and I'll get them on the line to answer it.",
      ],
    },
    field: {
      label: "Book the meeting",
      close: "Let's put twenty minutes on the calendar with [AE name] so you can see whether it's a fit. Does [day] at [time] or [time] work better?",
      confirm: "You're set for [day] at [time]. I'm sending the invite to [email] now. Could you accept it while we're on the phone so it doesn't get buried?",
      assumptive: [
        "Are mornings or afternoons usually better for you?",
        "I'll send an invite for [day] at [time]. If it doesn't work, just move it. Sound fair?",
      ],
    },
  },
};
