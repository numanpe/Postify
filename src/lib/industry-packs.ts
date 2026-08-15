import { INDUSTRIES } from "@/lib/industries";

export type Industry = (typeof INDUSTRIES)[number];

// Thin but genuinely differentiated per-industry content: tone plus
// hook/value-prop/CTA templates (captions, Phase 2) and
// context/message templates (video scripts, Phase 4). This is the
// "shared foundation" layer CLAUDE.md describes — combined with a
// company's own profile and Creative DNA at generation time, not a
// per-customer trained model. Depth grows as later phases consume the
// same packs; each phase only adds enough to make its output genuinely
// differ by industry, not a deep knowledge base.
export interface IndustryPack {
  toneDefault: string;
  hooks: string[];
  valueProps: string[];
  ctas: string[];
  // Video script sections (system #4's hook -> context -> value ->
  // message -> CTA structure). hooks/valueProps/ctas above are reused
  // for those three sections; these two are script-specific.
  scriptContexts: string[]; // sets up the situation/problem before the value prop
  scriptMessages: string[]; // ties directly to the specific topic being promoted
}

export const INDUSTRY_PACKS: Record<Industry, IndustryPack> = {
  Agriculture: {
    toneDefault: "warm, plainspoken, rooted in the land and the seasons",
    hooks: [
      "Fresh from the field to your table.",
      "The season's best is ready at {{company}}.",
      "Straight from our farm to your family.",
    ],
    valueProps: [
      "{{topic}} — grown with care, harvested at the right time, no shortcuts.",
      "At {{company}}, {{topic}} means quality you can taste and trust.",
      "We put the same care into {{topic}} that we put into every harvest.",
    ],
    ctas: [
      "Visit {{company}} this week for the season's best.",
      "Stop by {{company}} and taste the difference fresh makes.",
      "Ask us about {{topic}} on your next visit to {{company}}.",
    ],
    scriptContexts: [
      "Every season brings its own challenges — and its own chance to do right by the land.",
      "Good food starts long before it reaches your table.",
      "Farming rewards patience, and {{company}} has never taken shortcuts.",
    ],
    scriptMessages: [
      "{{topic}} is grown using methods refined over years on this land, not rushed for a season.",
      "When {{company}} puts its name on {{topic}}, that's a promise about how it was grown.",
      "{{topic}} reflects what {{company}} has always believed: real food takes real care.",
    ],
  },
  "Construction & Engineering": {
    toneDefault: "confident, precise, safety-and-craftsmanship focused",
    hooks: [
      "Built right. Built to last.",
      "Another project, another standard met at {{company}}.",
      "From blueprint to build, {{company}} delivers.",
    ],
    valueProps: [
      "{{topic}} — engineered with precision and delivered on schedule, every time.",
      "At {{company}}, {{topic}} means rigorous standards from day one to handover.",
      "Safety, craftsmanship, and deadlines — that's how {{company}} approaches {{topic}}.",
    ],
    ctas: [
      "Talk to {{company}} about your next project.",
      "Get a quote from {{company}} today.",
      "See how {{company}} can bring {{topic}} to life.",
    ],
    scriptContexts: [
      "Every build starts with a plan — and the discipline to follow it through.",
      "The gap between a good build and a great one is in the details most people never see.",
      "Deadlines and standards don't have to be a trade-off.",
    ],
    scriptMessages: [
      "{{topic}} was planned, engineered, and inspected the same way {{company}} handles every job — thoroughly.",
      "From the first blueprint to the final walkthrough, {{topic}} carries {{company}}'s standard.",
      "{{topic}} is proof that {{company}} builds the way it promises to.",
    ],
  },
  Education: {
    toneDefault: "encouraging, professional, focused on growth",
    hooks: [
      "Every learner has a spark — we help it grow.",
      "Learning that meets every student where they are.",
      "{{company}} believes in what your child can become.",
    ],
    valueProps: [
      "{{topic}} — personalized, supportive, and built around real progress.",
      "At {{company}}, {{topic}} is about building confidence, not just covering material.",
      "Our approach to {{topic}} puts every student's potential first.",
    ],
    ctas: [
      "Book a free trial class at {{company}} today.",
      "Enroll now and see the difference at {{company}}.",
      "Talk to our team at {{company}} about {{topic}}.",
    ],
    scriptContexts: [
      "Every student learns differently — the right support makes all the difference.",
      "Progress doesn't always look the way you expect it to.",
      "Confidence is built one real win at a time.",
    ],
    scriptMessages: [
      "{{topic}} at {{company}} is designed around how each student actually learns, not a one-size lesson plan.",
      "{{company}} built {{topic}} to turn small wins into lasting confidence.",
      "{{topic}} gives students the support to grow at their own pace, with {{company}} alongside them.",
    ],
  },
  "Real Estate": {
    toneDefault: "polished, aspirational, trustworthy",
    hooks: [
      "Your next chapter starts here.",
      "Find the space that fits your life.",
      "{{company}} makes finding home simple.",
    ],
    valueProps: [
      "{{topic}} — handled with local expertise and total transparency.",
      "At {{company}}, {{topic}} means no surprises, just results.",
      "We guide you through {{topic}} from first showing to closing day.",
    ],
    ctas: [
      "Schedule a viewing with {{company}} today.",
      "Contact {{company}} to start your search.",
      "Ask {{company}} about {{topic}} — we're here to help.",
    ],
    scriptContexts: [
      "Finding the right place is about more than square footage.",
      "The market moves fast — having someone who knows it well matters.",
      "A home should fit the life you're actually living.",
    ],
    scriptMessages: [
      "{{topic}} is where {{company}}'s local knowledge turns a search into a decision you feel good about.",
      "With {{topic}}, {{company}} handles the details so you can focus on what matters.",
      "{{topic}} reflects what {{company}} does best: matching people with the right place, honestly.",
    ],
  },
  Healthcare: {
    toneDefault: "calm, reassuring, evidence-based",
    hooks: [
      "Your health, in trusted hands.",
      "Care that listens first.",
      "{{company}} is here for every step of your care.",
    ],
    valueProps: [
      "{{topic}} — delivered with the attention and expertise you deserve.",
      "At {{company}}, {{topic}} starts with really listening to you.",
      "We take {{topic}} seriously, so you can feel confident in your care.",
    ],
    ctas: [
      "Book an appointment with {{company}} today.",
      "Reach out to {{company}} to learn more about {{topic}}.",
      "Your wellbeing matters — talk to {{company}} today.",
    ],
    scriptContexts: [
      "Good care starts with being heard, not rushed.",
      "Health decisions feel different when you trust who's guiding them.",
      "Prevention and attention go further than most people expect.",
    ],
    scriptMessages: [
      "{{topic}} at {{company}} means real time and real attention, not a rushed appointment.",
      "{{company}} approaches {{topic}} the way every patient deserves: carefully, and without guesswork.",
      "{{topic}} is part of how {{company}} earns your trust, one visit at a time.",
    ],
  },
  "Retail & E-commerce": {
    toneDefault: "energetic, direct, deal-forward",
    hooks: [
      "New in, and it won't last.",
      "{{company}} just dropped something you'll love.",
      "Shop smarter with {{company}}.",
    ],
    valueProps: [
      "{{topic}} — now available, made for how you actually shop.",
      "At {{company}}, {{topic}} means quality without the wait.",
      "We picked {{topic}} because our customers deserve better.",
    ],
    ctas: [
      "Shop {{topic}} at {{company}} now.",
      "Don't miss it — check out {{company}} today.",
      "Head to {{company}} before it's gone.",
    ],
    scriptContexts: [
      "You know the feeling when you find exactly what you were looking for.",
      "Good picks don't stick around long.",
      "Shopping should feel easy, not like a chore.",
    ],
    scriptMessages: [
      "{{topic}} just landed at {{company}}, and it's exactly the kind of pick our customers ask for.",
      "{{company}} chose {{topic}} because it's the real deal, not just another item on a shelf.",
      "{{topic}} is what happens when {{company}} actually listens to what you want.",
    ],
  },
  "Hospitality & Food": {
    toneDefault: "warm, sensory, inviting",
    hooks: [
      "Pull up a seat — {{company}} has been waiting for you.",
      "Some things are better shared.",
      "{{company}}: made fresh, served with care.",
    ],
    valueProps: [
      "{{topic}} — made from scratch, the way it should be.",
      "At {{company}}, {{topic}} is about the whole experience, not just the plate.",
      "Every {{topic}} at {{company}} starts with real ingredients and real care.",
    ],
    ctas: [
      "Reserve your table at {{company}} today.",
      "Come taste {{topic}} at {{company}} this week.",
      "Order from {{company}} and taste the difference.",
    ],
    scriptContexts: [
      "The best meals are the ones that feel like they were made just for you.",
      "Good food is worth doing properly, from the first ingredient to the last plate.",
      "Some places just feel like they were made for gathering.",
    ],
    scriptMessages: [
      "{{topic}} at {{company}} is made the way it should be — fresh, unhurried, and worth the seat.",
      "{{company}} built {{topic}} around real ingredients, not shortcuts.",
      "{{topic}} is {{company}}'s way of making an ordinary meal feel like an occasion.",
    ],
  },
  "Professional Services": {
    toneDefault: "clear, competent, no-nonsense",
    hooks: [
      "Expertise you can rely on.",
      "{{company}} handles the details so you don't have to.",
      "Straightforward advice, real results.",
    ],
    valueProps: [
      "{{topic}} — clear guidance, no jargon, no wasted time.",
      "At {{company}}, {{topic}} means answers you can actually act on.",
      "We bring real expertise to {{topic}}, so you can make confident decisions.",
    ],
    ctas: [
      "Book a consultation with {{company}} today.",
      "Get in touch with {{company}} about {{topic}}.",
      "Let {{company}} take {{topic}} off your plate.",
    ],
    scriptContexts: [
      "The right advice at the right time changes everything.",
      "Most problems get simpler once someone who knows the field looks at them.",
      "You shouldn't need a translator for your own decisions.",
    ],
    scriptMessages: [
      "{{topic}} is where {{company}} turns a complicated problem into a clear next step.",
      "{{company}} approaches {{topic}} the same way with every client: straight answers, real expertise.",
      "{{topic}} exists because {{company}} believes good advice shouldn't be complicated.",
    ],
  },
  Other: {
    toneDefault: "clear, genuine, professional",
    hooks: [
      "Here's what's new at {{company}}.",
      "{{company}} has something worth sharing.",
      "A quick update from {{company}}.",
    ],
    valueProps: [
      "{{topic}} — made with care by the team at {{company}}.",
      "At {{company}}, {{topic}} is something we're proud of.",
      "We think you'll love what {{company}} has done with {{topic}}.",
    ],
    ctas: [
      "Learn more at {{company}} today.",
      "Get in touch with {{company}} to find out more.",
      "Check out {{company}} for more on {{topic}}.",
    ],
    scriptContexts: [
      "Every business has a story behind what it makes.",
      "The details are usually where the real effort shows.",
      "Good work deserves a proper introduction.",
    ],
    scriptMessages: [
      "{{topic}} is the kind of thing {{company}} puts real thought into.",
      "{{company}} built {{topic}} to actually be useful, not just new.",
      "{{topic}} says a lot about how {{company}} does things.",
    ],
  },
};
