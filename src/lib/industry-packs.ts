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
  // Poster AI-background generation (src/lib/poster/background-context.ts):
  // concrete lighting/texture/mood guidance, not buzzwords — fed into the
  // Visual Prompt Engineer stage. forbiddenStyles are hard negative
  // constraints so an image model doesn't drift into a look that clashes
  // with the industry (e.g. neon cyberpunk for a farm poster).
  visualTone: string;
  forbiddenStyles: string[];
  // Campaign Generator (src/lib/campaign/creative-director.ts): the
  // free tier's real, non-random hashtag set for this industry — no
  // LLM call, so these can't be "AI-generated hashtags" the way BYOK's
  // can be, but they're genuine industry-relevant tags, not filler.
  hashtags: string[];
  // Short, 2-5 word punchy poster headlines — distinct from `hooks`
  // above, which are full sentences meant for captions/scripts. A
  // poster headline needs to read at a glance, not like a caption.
  shortHeadlines: string[];
  // Real bug found from a real generated caption: "We Handle The
  // Details means answers you can actually act on." studio-wizard.ts's
  // "Auto-Generate Daily Idea" used to draw its {{topic}} straight from
  // shortHeadlines above — but those are standalone marketing slogans
  // written to stand alone on a poster, not noun phrases shaped to sit
  // grammatically inside "{{topic}} means...", "we bring expertise to
  // {{topic}}...", "let {{company}} take {{topic}} off your plate."
  // Splicing a slogan into a sentence built for a noun phrase produces
  // exactly this kind of broken English. autoTopics exists specifically
  // to be grammatical there: every entry here was checked against every
  // {{topic}} template slot in this industry's own valueProps/ctas/
  // scriptMessages, and deliberately kept singular/mass/gerund-shaped
  // (never plural) since several templates use a singular verb
  // ("means", "is", "gets", "exists") directly after {{topic}}.
  autoTopics: string[];
}

export const INDUSTRY_PACKS: Record<Industry, IndustryPack> = {
  Agriculture: {
    toneDefault: "warm, plainspoken, rooted in the land and the seasons",
    hooks: [
      "Fresh from the field to your table.",
      "The season's best is ready right now.",
      "Straight from our farm to your family.",
    ],
    valueProps: [
      "{{topic}} — grown with care, harvested at the right time, no shortcuts.",
      "{{topic}} means quality you can taste and trust.",
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
      "Farming rewards patience, and shortcuts have never been part of the plan.",
    ],
    scriptMessages: [
      "{{topic}} is grown using methods refined over years on this land, not rushed for a season.",
      "Putting our name on {{topic}} is a promise about how it was grown.",
      "{{topic}} reflects what we've always believed: real food takes real care.",
    ],
    visualTone: "Warm natural sunlight, organic textures, wide open fields, golden-hour lighting",
    forbiddenStyles: ["neon cyberpunk", "futuristic sci-fi", "dark dystopian tones", "urban concrete backdrops"],
    hashtags: ["#Agriculture", "#FarmFresh", "#LocalFarm", "#Harvest", "#SupportLocal"],
    shortHeadlines: ["Fresh From Our Fields", "Harvested With Care", "Grown Right, Every Time"],
    autoTopics: ["this week's harvest", "our seasonal produce", "our farm-fresh selection"],
  },
  "Construction & Engineering": {
    toneDefault: "confident, precise, safety-and-craftsmanship focused",
    hooks: [
      "Built right. Built to last.",
      "Another project, another standard met.",
      "From blueprint to build, the standard never slips.",
    ],
    valueProps: [
      "{{topic}} — engineered with precision and delivered on schedule, every time.",
      "{{topic}} means rigorous standards from day one to handover.",
      "Safety, craftsmanship, and deadlines — that's how we approach {{topic}}.",
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
      "{{topic}} was planned, engineered, and inspected the same thorough way every job gets handled.",
      "From the first blueprint to the final walkthrough, {{topic}} carries that same standard.",
      "{{topic}} is proof that a promise made gets built the way it was promised.",
    ],
    visualTone: "Clean industrial lines, steel and concrete textures, dramatic directional light, structured geometry",
    forbiddenStyles: ["whimsical cartoon style", "pastel soft-focus", "organic wilderness", "cluttered chaotic composition"],
    hashtags: ["#Construction", "#Engineering", "#BuiltToLast", "#ProjectManagement", "#Craftsmanship"],
    shortHeadlines: ["Built To Last", "Precision You Can Trust", "Another Standard Met"],
    autoTopics: ["our latest build", "your next project", "this current build"],
  },
  Education: {
    toneDefault: "encouraging, professional, focused on growth",
    hooks: [
      "Every learner has a spark — we help it grow.",
      "Learning that meets every student where they are.",
      "Believing in what your child can become — that's where it starts.",
    ],
    valueProps: [
      "{{topic}} — personalized, supportive, and built around real progress.",
      "{{topic}} is about building confidence, not just covering material.",
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
      "{{topic}} is designed around how each student actually learns, not a one-size lesson plan.",
      "{{topic}} was built to turn small wins into lasting confidence.",
      "{{topic}} gives students the support to grow at their own pace, every step of the way.",
    ],
    visualTone: "Bright even lighting, clean modern spaces, optimistic open composition",
    forbiddenStyles: ["dark moody tones", "neon cyberpunk", "cluttered chaotic composition", "unsettling imagery"],
    hashtags: ["#Education", "#Learning", "#StudentSuccess", "#EnrollNow", "#BackToSchool"],
    shortHeadlines: ["Learning That Sticks", "Confidence Starts Here", "Your Next Step Forward"],
    autoTopics: ["your child's learning journey", "this term's program", "our small-group tutoring"],
  },
  "Real Estate": {
    toneDefault: "polished, aspirational, trustworthy",
    hooks: [
      "Your next chapter starts here.",
      "Find the space that fits your life.",
      "Finding home doesn't have to be complicated.",
    ],
    valueProps: [
      "{{topic}} — handled with local expertise and total transparency.",
      "{{topic}} means no surprises, just results.",
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
      "{{topic}} is where local knowledge turns a search into a decision you feel good about.",
      "With {{topic}}, the details are handled so you can focus on what matters.",
      "{{topic}} reflects what matters most: matching people with the right place, honestly.",
    ],
    visualTone: "Polished architectural lines, natural window light, aspirational interiors and exteriors",
    forbiddenStyles: ["cluttered rooms", "cartoon style", "neon cyberpunk", "harsh overexposed lighting"],
    hashtags: ["#RealEstate", "#DreamHome", "#PropertyForSale", "#HomeSearch", "#JustListed"],
    shortHeadlines: ["Your Next Chapter Awaits", "Home Starts Here", "Find Your Fit"],
    autoTopics: ["your home search", "this week's newest listing", "your next move"],
  },
  Healthcare: {
    toneDefault: "calm, reassuring, evidence-based",
    hooks: [
      "Your health, in trusted hands.",
      "Care that listens first.",
      "Here for every step of your care.",
    ],
    valueProps: [
      "{{topic}} — delivered with the attention and expertise you deserve.",
      "{{topic}} starts with really listening to you.",
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
      "{{topic}} means real time and real attention, not a rushed appointment.",
      "{{topic}} gets the same approach every patient deserves: carefully, and without guesswork.",
      "{{topic}} is part of how trust gets earned, one visit at a time.",
    ],
    visualTone: "Soft even clinical-clean lighting, calm neutral tones, gentle depth of field",
    forbiddenStyles: ["dark horror tones", "neon cyberpunk", "chaotic cluttered scenes", "graphic medical imagery"],
    hashtags: ["#Healthcare", "#PatientCare", "#WellnessJourney", "#HealthyLiving", "#BookNow"],
    shortHeadlines: ["Care That Listens", "Your Health, Our Focus", "Trusted Care, Every Visit"],
    autoTopics: ["your care plan", "your next visit", "preventive care"],
  },
  "Retail & E-commerce": {
    toneDefault: "energetic, direct, deal-forward",
    hooks: [
      "New in, and it won't last.",
      "Something new just dropped — you'll love this one.",
      "Shop smarter, starting today.",
    ],
    valueProps: [
      "{{topic}} — now available, made for how you actually shop.",
      "{{topic}} means quality without the wait.",
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
      "{{topic}} just landed, and it's exactly the kind of pick customers ask for.",
      "{{topic}} made the cut because it's the real deal, not just another item on a shelf.",
      "{{topic}} is what happens when you actually listen to what people want.",
    ],
    visualTone: "Bright punchy studio lighting, bold product-forward composition, vibrant color accents",
    forbiddenStyles: ["dark moody tones", "cluttered chaotic composition", "rustic vintage textures", "flat low-contrast lighting"],
    hashtags: ["#ShopNow", "#NewArrival", "#RetailTherapy", "#LimitedStock", "#SaleAlert"],
    shortHeadlines: ["Just Dropped", "Shop The New Arrivals", "Deals Worth Sharing"],
    autoTopics: ["this season's collection", "our latest drop", "this week's lineup"],
  },
  "Hospitality & Food": {
    toneDefault: "warm, sensory, inviting",
    hooks: [
      "Pull up a seat — this one's been worth the wait.",
      "Some things are better shared.",
      "Made fresh, served with care.",
    ],
    valueProps: [
      "{{topic}} — made from scratch, the way it should be.",
      "{{topic}} is about the whole experience, not just the plate.",
      "{{topic}} — real ingredients, real care, every time.",
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
      "{{topic}} is made the way it should be — fresh, unhurried, and worth the seat.",
      "{{topic}} is built around real ingredients, not shortcuts.",
      "{{topic}} is proof an ordinary meal can feel like an occasion.",
    ],
    visualTone: "Warm ambient lighting, rich food and table textures, inviting shallow depth of field",
    forbiddenStyles: ["cold clinical lighting", "neon cyberpunk", "cartoon style", "artificial plastic textures"],
    hashtags: ["#Foodie", "#EatLocal", "#MadeFresh", "#DineWithUs", "#TasteTheDifference"],
    shortHeadlines: ["Made Fresh Daily", "Pull Up A Seat", "Taste The Difference"],
    autoTopics: ["tonight's special", "our new menu", "this week's tasting menu"],
  },
  "Professional Services": {
    toneDefault: "clear, competent, no-nonsense",
    hooks: [
      "Expertise you can rely on.",
      "Handling the details so you don't have to.",
      "Straightforward advice, real results.",
    ],
    valueProps: [
      "{{topic}} — clear guidance, no jargon, no wasted time.",
      "{{topic}} means answers you can actually act on.",
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
      "{{topic}} is where a complicated problem turns into a clear next step.",
      "{{topic}} gets the same approach with every client: straight answers, real expertise.",
      "{{topic}} exists because good advice shouldn't be complicated.",
    ],
    visualTone: "Clean minimal studio lighting, sharp geometric composition, muted confident palette",
    forbiddenStyles: ["cluttered chaotic composition", "neon cyberpunk", "whimsical cartoon style", "rustic vintage textures"],
    hashtags: ["#ProfessionalServices", "#Consulting", "#ExpertAdvice", "#TrustedPartner", "#GetInTouch"],
    shortHeadlines: ["Expertise You Can Trust", "Straight Answers, Real Results", "We Handle The Details"],
    autoTopics: ["your business planning", "your next consultation", "your compliance review"],
  },
  Other: {
    toneDefault: "clear, genuine, professional",
    hooks: [
      "Here's what's new.",
      "There's something worth sharing today.",
      "A quick update, straight from the team.",
    ],
    valueProps: [
      "{{topic}} — made with care by the whole team.",
      "{{topic}} is something we're proud of.",
      "We think you'll love what's been done with {{topic}}.",
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
      "{{topic}} is the kind of thing we put real thought into.",
      "{{topic}} was built to actually be useful, not just new.",
      "{{topic}} says a lot about how we do things.",
    ],
    visualTone: "Clean natural lighting, genuine real-world setting, balanced composition",
    forbiddenStyles: ["neon cyberpunk", "dark dystopian tones", "cartoon style", "cluttered chaotic composition"],
    hashtags: ["#SmallBusiness", "#ShopLocal", "#NewPost", "#CheckItOut", "#SupportLocal"],
    shortHeadlines: ["Something New Is Here", "Worth Sharing", "See What Is New"],
    autoTopics: ["our latest project", "this week's update", "our newest offering"],
  },
};

// Deterministic per-industry composition style for design_parameters —
// not random, so the same industry always leans toward the same visual
// language across generations.
export const INDUSTRY_COMPOSITION_STYLE: Record<Industry, "Minimalist" | "Bold Geometric" | "Organic"> = {
  Agriculture: "Organic",
  "Construction & Engineering": "Bold Geometric",
  Education: "Minimalist",
  "Real Estate": "Bold Geometric",
  Healthcare: "Minimalist",
  "Retail & E-commerce": "Bold Geometric",
  "Hospitality & Food": "Organic",
  "Professional Services": "Minimalist",
  Other: "Minimalist",
};
