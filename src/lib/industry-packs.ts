import { INDUSTRIES } from "@/lib/industries";

export type Industry = (typeof INDUSTRIES)[number];

// Thin but genuinely differentiated per-industry content: tone plus
// hook/value-prop/CTA templates. This is the "shared foundation" layer
// CLAUDE.md describes — combined with a company's own profile and
// Creative DNA at generation time, not a per-customer trained model.
// Depth grows as later phases (poster/video pipelines) consume the same
// packs; Phase 2 only needs enough to make text generation genuinely
// differ by industry, not a deep knowledge base.
export interface IndustryPack {
  toneDefault: string;
  hooks: string[];
  valueProps: string[];
  ctas: string[];
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
  },
};
