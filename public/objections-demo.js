// Demo objection library. Generic, original wording with no company names,
// so the tool can be shown publicly. Load your own set from the Manage panel
// (Import), or edit cards in the app; changes are saved in your browser only.
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
  name: "Demo set",
  // Quick picks: what 1–9 open before you type anything.
  pins: ["not-interested", "too-expensive", "partner", "busy", "send-info", "think-about-it", "not-right-time", "competitor", "how-did-you-get-my-number"],
  modes: {
    inside: { name: "Transfer", hint: "live handoff" },
    field: { name: "Appointment", hint: "book a visit" },
  },
  groups: ["Brush-offs", "Price and value", "Timing", "Decision makers", "Trust"],
  objections: [
    // ------------------------------------------------------------ Brush-offs
    {
      id: "not-interested",
      title: "Just not interested",
      group: "Brush-offs",
      cue: "Not asking for a decision, just a quick look at real numbers.",
      keywords: ["not interested", "interested", "no thanks", "no thank you", "pass", "nope", "im good"],
      probe: {
        ask: "Totally fair. So I can note your file, is it the cost, the timing, or something else?",
        answers: [
          { label: "Cost", text: "Makes sense. That's actually the main thing the specialist walks through, so you can see real numbers instead of guessing." },
          { label: "Timing", text: "No pressure on timing at all. Let's just get you the details now so you have them whenever you're ready." },
          { label: "Something else", text: "Fair enough. A quick look costs you nothing, and if it isn't a fit, you'll know for sure." },
        ],
      },
      rebuttals: [
        { text: "I hear you, and I'm not asking you to decide anything today. You'd asked about this before, so I just want to make sure you saw real numbers before closing the door." },
        { text: "Can I ask, is it that you're not interested in the idea, or not interested in another sales call? Because this is just a quick review, not a pitch." },
      ],
    },
    {
      id: "send-info",
      title: "Just send me something",
      group: "Brush-offs",
      cue: "Generic info won't fit them. Two minutes on their details, then it lands in their inbox.",
      keywords: ["send", "email", "mail", "brochure", "info", "information", "text me", "website"],
      rebuttals: [
        { text: "Happy to. The catch is that anything generic won't tell you much, because the details depend on your situation. Let me get you with a specialist for a few minutes, and what they send will actually apply to you." },
        { text: "Sure thing. So we send the right thing, let's spend two minutes on your details now, and that's exactly what will land in your inbox." },
      ],
    },
    {
      id: "busy",
      title: "I'm busy / can't talk right now",
      group: "Brush-offs",
      cue: "Keep it to thirty seconds, then the close.",
      keywords: ["busy", "working", "cant talk", "driving", "bad time", "call back", "meeting", "at work"],
      rebuttals: [
        { text: "Understood, I'll be quick. Let me get the specialist on the line to start the conversation, and they can follow up when it suits you better.", mode: "inside" },
        { text: "No problem, this takes thirty seconds. I just want to get a short visit on the calendar. Does [day] at [time] or [time] work better?", mode: "field" },
      ],
    },
    {
      id: "how-did-you-get-my-number",
      title: "How did you get my number?",
      group: "Brush-offs",
      cue: "They asked before. Confirm the address, offer to update their file.",
      keywords: ["number", "how did you get", "never signed up", "didnt request", "who is this", "spam", "list"],
      rebuttals: [
        { text: "Good question. It looks like you or someone at this address asked us about this before. I'm just following up so nobody was left hanging. Are you still at [address]?" },
        { text: "I understand being careful. If you'd rather not hear from us, I'll update your file right now. Before I do, can I ask whether it's still something you're curious about?" },
      ],
    },

    // -------------------------------------------------------- Price and value
    {
      id: "too-expensive",
      title: "Too expensive",
      group: "Price and value",
      cue: "Price is the first thing the specialist reviews. More options than they expect.",
      keywords: ["expensive", "price", "cost", "money", "afford", "pricey", "budget", "payment"],
      rebuttals: [
        { text: "That's exactly why I'm calling. If the numbers you saw didn't work, let's get a second set of eyes on them and see what actually fits your budget." },
        { text: "Totally fair. Price is the first thing a specialist reviews with you, and there are usually more options than people expect." },
      ],
    },
    {
      id: "not-worth-it",
      title: "It's not worth it",
      group: "Price and value",
      cue: "Test it with real numbers. Worst case, they know for sure.",
      keywords: ["worth", "value", "doesnt work", "waste", "payback", "savings", "pointless"],
      rebuttals: [
        { text: "That really depends on the situation, which is why we look at yours instead of guessing. If it isn't worth it for you, the specialist will tell you." },
        { text: "Let's put it to the test with real numbers. Worst case, you'll know for sure and won't have to wonder." },
      ],
    },
    {
      id: "competitor",
      title: "Going with another company",
      group: "Price and value",
      cue: "Comparing is smart. Get a second option to line up side by side.",
      keywords: ["competitor", "another company", "other company", "went with", "signed", "someone else", "quote"],
      rebuttals: [
        { text: "Great, it's smart to compare. Let's get you a second option in hand so you can line them up side by side before you commit." },
      ],
    },

    // ----------------------------------------------------------------- Timing
    {
      id: "think-about-it",
      title: "I need to think about it",
      group: "Timing",
      cue: "Ask what they'd want to think through. Real numbers make thinking easier.",
      keywords: ["think", "think about it", "consider", "sleep on it", "decide", "not sure", "mull"],
      rebuttals: [
        { text: "Of course. What's the main thing you'd want to think through? I'll make sure the specialist covers it." },
        { text: "That makes sense. This step just gives you the full picture, so when you do think it over, you're working with real numbers." },
      ],
    },
    {
      id: "not-right-time",
      title: "Not the right time",
      group: "Timing",
      cue: "No timeline. Get the details ready for when the time is right.",
      keywords: ["time", "timing", "later", "wait", "next year", "holidays", "not ready", "few months"],
      rebuttals: [
        { text: "No timeline from us at all. Let's just go over the details now so you have everything ready when the time is right." },
        { text: "Understood. Would it help to book something a couple of weeks out, so it's on the calendar without any rush?", mode: "field" },
      ],
    },

    // -------------------------------------------------------- Decision makers
    {
      id: "partner",
      title: "Need to talk to my spouse / partner",
      group: "Decision makers",
      cue: "Joint decision. Get real numbers in front of both of them.",
      keywords: ["spouse", "wife", "husband", "partner", "talk to", "other half", "family"],
      probe: {
        ask: "Have they seen any numbers yet?",
        answers: [
          { label: "Yes", text: "What part didn't sit well with them?", coach: "Find the real reason, then pick that objection." },
          { label: "No", text: "Then let's get you real numbers, so you two have something concrete to talk through." },
        ],
      },
      rebuttals: [
        { text: "Absolutely, it should be a joint decision. Let's get the information in front of you both so you can review it together, on your own time." },
        { text: "Makes sense. Is there a time when you're both around? I can book it so you hear it together.", mode: "field" },
      ],
    },
    {
      id: "not-decision-maker",
      title: "I'm not the one who decides",
      group: "Decision makers",
      cue: "Fine. Go over it with them, and the specialist loops in the decider.",
      keywords: ["not my decision", "decision maker", "owner", "not the owner", "boss", "landlord", "parents"],
      rebuttals: [
        { text: "No problem. We can go over it with you, and the specialist can loop in whoever makes the call." },
      ],
    },

    // ------------------------------------------------------------------ Trust
    {
      id: "bad-reviews",
      title: "I've heard bad things / bad reviews",
      group: "Trust",
      cue: "Fair concern. This is information only, no commitment.",
      keywords: ["reviews", "bad", "heard", "online", "reputation", "scam", "complaints"],
      rebuttals: [
        { text: "That's a fair concern with any company. Most customers have a good experience, and when someone doesn't, we work to make it right." },
        { text: "I read reviews too. This is just information, with no commitment, so you can judge it for yourself." },
      ],
    },
    {
      id: "pushy-sales",
      title: "I don't want a sales pitch",
      group: "Trust",
      cue: "No pressure. It's a review of options, and they stay in control.",
      keywords: ["pushy", "pitch", "salesman", "salesperson", "pressure", "sold", "hard sell"],
      rebuttals: [
        { text: "Totally get it, nobody likes pressure. This is a review of your options, and if it doesn't make sense, the specialist will say so." },
        { text: "Fair enough. You stay in control the whole time, and looking at the numbers doesn't commit you to anything." },
      ],
    },
    {
      id: "already-working",
      title: "Already working with someone",
      group: "Trust",
      cue: "Good to hear. Get their rep back, or someone on the team.",
      keywords: ["already", "working with", "rep", "consultant", "someone", "have a guy"],
      rebuttals: [
        { text: "Good to hear. Let me try to get them back on the line, and if they're tied up, I'll connect you with someone on their team.", mode: "inside" },
        { text: "Great. I can book your next visit with the same person you've been working with.", mode: "field", note: "Assign it to their existing contact." },
      ],
    },
  ],
  transitions: {
    inside: {
      label: "Live transfer to a specialist",
      close: "Give me about thirty seconds to bring a specialist on the line. If you can, grab a recent bill so they can look at real numbers.",
      assumptive: [
        "Perfect, one moment while I connect you.",
        "Great question for the specialist. Hang on and I'll get them on the line to answer it.",
      ],
    },
    field: {
      label: "Book an appointment",
      close: "A specialist can come by on [day] at [time] or [time]. Which works better for you?",
      confirm: "You're all set for [appointment time]. Have a recent bill handy if you can, and we'll see you then!",
      assumptive: [
        "Are mornings or afternoons usually better for you?",
        "Let's put you down for [day] at [time], which gives you a little time first. How does that sound?",
      ],
    },
  },
};
