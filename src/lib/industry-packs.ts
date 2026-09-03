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
  // Real, industry-relevant starting points shown as suggestions on
  // topic/prompt fields (Studio, Campaign, Repurpose) — the fastest way
  // to guarantee well-formed input, without forcing it (free typing
  // always stays allowed). `label` is what's shown/searched (can read
  // like a headline, e.g. "New harvest ready"); `topic` is what
  // actually fills the field when picked — kept to the exact same
  // singular/mass noun-phrase discipline as autoTopics above, for the
  // exact same real reason: a headline-style label spliced straight
  // into "{{topic}} means..." would reproduce the broken-English bug
  // autoTopics was built to fix, just from a different source.
  topicSuggestions: { label: string; topic: string }[];
}

export const INDUSTRY_PACKS: Record<Industry, IndustryPack> = {
  Agriculture: {
    toneDefault: "warm, plainspoken, rooted in the land and the seasons",
    hooks: [
      "Fresh from the field to your table.",
      "The season's best is ready right now.",
      "Straight from our farm to your family.",
      "Some things are worth doing the slow way.",
      "Good soil, honest work, real food.",
      "This is what fresh actually tastes like.",
    ],
    valueProps: [
      "{{topic}} — grown with care, harvested at the right time, no shortcuts.",
      "{{topic}} means quality you can taste and trust.",
      "We put the same care into {{topic}} that we put into every harvest.",
      "{{topic}} comes from soil we know and seasons we respect.",
      "Nothing about {{topic}} is rushed — good food never is.",
      "{{topic}} is proof that doing it right still matters.",
    ],
    ctas: [
      "Visit {{company}} this week for the season's best.",
      "Stop by {{company}} and taste the difference fresh makes.",
      "Ask us about {{topic}} on your next visit to {{company}}.",
      "Come see {{company}} for yourself this week.",
      "{{company}} is open and the harvest is ready.",
      "Reach out to {{company}} to learn more about {{topic}}.",
    ],
    scriptContexts: [
      "Every season brings its own challenges — and its own chance to do right by the land.",
      "Good food starts long before it reaches your table.",
      "Farming rewards patience, and shortcuts have never been part of the plan.",
      "Real food has a real story behind it — most people just never see it.",
      "The work doesn't stop because it's convenient — it stops when it's done right.",
      "There's a difference between food that's grown and food that's just produced.",
    ],
    scriptMessages: [
      "{{topic}} is grown using methods refined over years on this land, not rushed for a season.",
      "Putting our name on {{topic}} is a promise about how it was grown.",
      "{{topic}} reflects what we've always believed: real food takes real care.",
      "{{topic}} carries the same standard every harvest gets, season after season.",
      "There's no substitute for doing {{topic}} the honest way, start to finish.",
      "{{topic}} is what happens when patience and know-how meet real land.",
    ],
    visualTone: "Warm natural sunlight, organic textures, wide open fields, golden-hour lighting",
    forbiddenStyles: ["neon cyberpunk", "futuristic sci-fi", "dark dystopian tones", "urban concrete backdrops"],
    hashtags: ["#Agriculture", "#FarmFresh", "#LocalFarm", "#Harvest", "#SupportLocal"],
    shortHeadlines: ["Fresh From Our Fields", "Harvested With Care", "Grown Right, Every Time"],
    autoTopics: ["this week's harvest", "our seasonal produce", "our farm-fresh selection"],
    topicSuggestions: [
      { label: "New harvest ready", topic: "our new harvest" },
      { label: "Seasonal supply update", topic: "this season's supply" },
      { label: "Customer success story", topic: "a recent customer success story" },
      { label: "Sustainable farming practices", topic: "our sustainable farming practices" },
      { label: "Meet the team", topic: "the team behind our farm" },
    ],
  },
  "Construction & Engineering": {
    toneDefault: "confident, precise, safety-and-craftsmanship focused",
    hooks: [
      "Built right. Built to last.",
      "Another project, another standard met.",
      "From blueprint to build, the standard never slips.",
      "Precision isn't optional — it's the whole job.",
      "Every project gets the same discipline, start to finish.",
      "The details most people never see are the ones we sweat.",
    ],
    valueProps: [
      "{{topic}} — engineered with precision and delivered on schedule, every time.",
      "{{topic}} means rigorous standards from day one to handover.",
      "Safety, craftsmanship, and deadlines — that's how we approach {{topic}}.",
      "{{topic}} gets inspected, checked, and inspected again — no cut corners.",
      "{{topic}} is planned to the same standard whether anyone's watching or not.",
      "{{topic}} reflects a simple rule: build it once, build it right.",
    ],
    ctas: [
      "Talk to {{company}} about your next project.",
      "Get a quote from {{company}} today.",
      "See how {{company}} can bring {{topic}} to life.",
      "Reach out to {{company}} to start the conversation.",
      "{{company}} is ready when your project is.",
      "Contact {{company}} to talk through {{topic}}.",
    ],
    scriptContexts: [
      "Every build starts with a plan — and the discipline to follow it through.",
      "The gap between a good build and a great one is in the details most people never see.",
      "Deadlines and standards don't have to be a trade-off.",
      "A structure only has to fail once to prove why standards matter.",
      "The best work looks simple because the hard part happened before anyone saw it.",
      "Every project tests the same thing: can the plan survive contact with reality.",
    ],
    scriptMessages: [
      "{{topic}} was planned, engineered, and inspected the same thorough way every job gets handled.",
      "From the first blueprint to the final walkthrough, {{topic}} carries that same standard.",
      "{{topic}} is proof that a promise made gets built the way it was promised.",
      "{{topic}} went through the same checks every project gets, no exceptions made.",
      "{{topic}} reflects a simple standard: right the first time, not fixed later.",
      "Every phase of {{topic}} answers to the same discipline, from groundwork to handover.",
    ],
    visualTone: "Clean industrial lines, steel and concrete textures, dramatic directional light, structured geometry",
    forbiddenStyles: ["whimsical cartoon style", "pastel soft-focus", "organic wilderness", "cluttered chaotic composition"],
    hashtags: ["#Construction", "#Engineering", "#BuiltToLast", "#ProjectManagement", "#Craftsmanship"],
    shortHeadlines: ["Built To Last", "Precision You Can Trust", "Another Standard Met"],
    autoTopics: ["our latest build", "your next project", "this current build"],
    topicSuggestions: [
      { label: "Project milestone reached", topic: "our latest project milestone" },
      { label: "Safety-first update", topic: "our safety standards" },
      { label: "Before & after showcase", topic: "a recent before-and-after transformation" },
      { label: "New equipment or capability", topic: "our newest equipment" },
      { label: "Client testimonial", topic: "a recent client testimonial" },
    ],
  },
  Education: {
    toneDefault: "encouraging, professional, focused on growth",
    hooks: [
      "Every learner has a spark — we help it grow.",
      "Learning that meets every student where they are.",
      "Believing in what your child can become — that's where it starts.",
      "Real progress looks different for every student.",
      "Confidence is built one lesson at a time.",
      "The right support changes what's possible.",
    ],
    valueProps: [
      "{{topic}} — personalized, supportive, and built around real progress.",
      "{{topic}} is about building confidence, not just covering material.",
      "Our approach to {{topic}} puts every student's potential first.",
      "{{topic}} meets each student exactly where they are, not where a schedule says they should be.",
      "{{topic}} is measured in real understanding, not just completed worksheets.",
      "{{topic}} is built around one goal: genuine, lasting progress.",
    ],
    ctas: [
      "Book a free trial class at {{company}} today.",
      "Enroll now and see the difference at {{company}}.",
      "Talk to our team at {{company}} about {{topic}}.",
      "Reach out to {{company}} to get started.",
      "{{company}} has room for your child this term.",
      "Contact {{company}} to learn more about {{topic}}.",
    ],
    scriptContexts: [
      "Every student learns differently — the right support makes all the difference.",
      "Progress doesn't always look the way you expect it to.",
      "Confidence is built one real win at a time.",
      "The right moment of understanding can change how a student sees themselves.",
      "Real learning rarely follows a straight line, and that's exactly the point.",
      "Support that actually fits a student looks different for every single one.",
    ],
    scriptMessages: [
      "{{topic}} is designed around how each student actually learns, not a one-size lesson plan.",
      "{{topic}} was built to turn small wins into lasting confidence.",
      "{{topic}} gives students the support to grow at their own pace, every step of the way.",
      "{{topic}} meets a student where they actually are, not where a syllabus assumes.",
      "{{topic}} is built on the idea that real progress deserves real patience.",
      "{{topic}} turns understanding into something a student can carry forward.",
    ],
    visualTone: "Bright even lighting, clean modern spaces, optimistic open composition",
    forbiddenStyles: ["dark moody tones", "neon cyberpunk", "cluttered chaotic composition", "unsettling imagery"],
    hashtags: ["#Education", "#Learning", "#StudentSuccess", "#EnrollNow", "#BackToSchool"],
    shortHeadlines: ["Learning That Sticks", "Confidence Starts Here", "Your Next Step Forward"],
    autoTopics: ["your child's learning journey", "this term's program", "our small-group tutoring"],
    topicSuggestions: [
      { label: "New program launch", topic: "our new program" },
      { label: "Student success story", topic: "a recent student success story" },
      { label: "Enrollment reminder", topic: "open enrollment" },
      { label: "Meet the teacher", topic: "one of our instructors" },
      { label: "Upcoming term schedule", topic: "next term's schedule" },
    ],
  },
  "Real Estate": {
    toneDefault: "polished, aspirational, trustworthy",
    hooks: [
      "Your next chapter starts here.",
      "Find the space that fits your life.",
      "Finding home doesn't have to be complicated.",
      "The right place is out there — let's find it.",
      "A home should fit the life you're actually living.",
      "Good timing and local knowledge change everything.",
    ],
    valueProps: [
      "{{topic}} — handled with local expertise and total transparency.",
      "{{topic}} means no surprises, just results.",
      "We guide you through {{topic}} from first showing to closing day.",
      "{{topic}} gets the same honest, detailed attention every client deserves.",
      "{{topic}} is about matching people with the right place, not just any place.",
      "{{topic}} is handled with the local knowledge that makes the difference.",
    ],
    ctas: [
      "Schedule a viewing with {{company}} today.",
      "Contact {{company}} to start your search.",
      "Ask {{company}} about {{topic}} — we're here to help.",
      "Reach out to {{company}} to learn more.",
      "{{company}} is ready to help with your next move.",
      "Get in touch with {{company}} about {{topic}}.",
    ],
    scriptContexts: [
      "Finding the right place is about more than square footage.",
      "The market moves fast — having someone who knows it well matters.",
      "A home should fit the life you're actually living.",
      "The right property search feels less like a hunt and more like a conversation.",
      "Every listing has a story the numbers alone won't tell you.",
      "Timing and local knowledge decide more than most buyers realize.",
    ],
    scriptMessages: [
      "{{topic}} is where local knowledge turns a search into a decision you feel good about.",
      "With {{topic}}, the details are handled so you can focus on what matters.",
      "{{topic}} reflects what matters most: matching people with the right place, honestly.",
      "{{topic}} gets the same attention to detail every client deserves, start to close.",
      "{{topic}} is handled with the transparency that turns a search into confidence.",
      "{{topic}} is about finding the right fit, not just the next available listing.",
    ],
    visualTone: "Polished architectural lines, natural window light, aspirational interiors and exteriors",
    forbiddenStyles: ["cluttered rooms", "cartoon style", "neon cyberpunk", "harsh overexposed lighting"],
    hashtags: ["#RealEstate", "#DreamHome", "#PropertyForSale", "#HomeSearch", "#JustListed"],
    shortHeadlines: ["Your Next Chapter Awaits", "Home Starts Here", "Find Your Fit"],
    autoTopics: ["your home search", "this week's newest listing", "your next move"],
    topicSuggestions: [
      { label: "New listing", topic: "our newest listing" },
      { label: "Just sold", topic: "a recent successful sale" },
      { label: "Market update", topic: "the current market" },
      { label: "Open house announcement", topic: "this weekend's open house" },
      { label: "Client testimonial", topic: "a recent client testimonial" },
    ],
  },
  Healthcare: {
    toneDefault: "calm, reassuring, evidence-based",
    hooks: [
      "Your health, in trusted hands.",
      "Care that listens first.",
      "Here for every step of your care.",
      "Real attention, not a rushed appointment.",
      "Prevention starts with being heard.",
      "Trust is earned one visit at a time.",
    ],
    valueProps: [
      "{{topic}} — delivered with the attention and expertise you deserve.",
      "{{topic}} starts with really listening to you.",
      "We take {{topic}} seriously, so you can feel confident in your care.",
      "{{topic}} means real time with someone who knows your history.",
      "{{topic}} is handled carefully, without guesswork or shortcuts.",
      "{{topic}} gets the same thorough attention every patient deserves.",
    ],
    ctas: [
      "Book an appointment with {{company}} today.",
      "Reach out to {{company}} to learn more about {{topic}}.",
      "Your wellbeing matters — talk to {{company}} today.",
      "Contact {{company}} to schedule your visit.",
      "{{company}} has availability this week.",
      "Get in touch with {{company}} about {{topic}}.",
    ],
    scriptContexts: [
      "Good care starts with being heard, not rushed.",
      "Health decisions feel different when you trust who's guiding them.",
      "Prevention and attention go further than most people expect.",
      "The best care often starts with a question no one else took the time to ask.",
      "Real trust in healthcare is built visit by visit, not assumed.",
      "Small, consistent attention prevents more than a single big intervention ever could.",
    ],
    scriptMessages: [
      "{{topic}} means real time and real attention, not a rushed appointment.",
      "{{topic}} gets the same approach every patient deserves: carefully, and without guesswork.",
      "{{topic}} is part of how trust gets earned, one visit at a time.",
      "{{topic}} starts with listening, not assuming what you need.",
      "{{topic}} reflects a simple standard: careful attention, every single visit.",
      "{{topic}} is handled with the same seriousness every patient's care deserves.",
    ],
    visualTone: "Soft even clinical-clean lighting, calm neutral tones, gentle depth of field",
    forbiddenStyles: ["dark horror tones", "neon cyberpunk", "chaotic cluttered scenes", "graphic medical imagery"],
    hashtags: ["#Healthcare", "#PatientCare", "#WellnessJourney", "#HealthyLiving", "#BookNow"],
    shortHeadlines: ["Care That Listens", "Your Health, Our Focus", "Trusted Care, Every Visit"],
    autoTopics: ["your care plan", "your next visit", "preventive care"],
    topicSuggestions: [
      { label: "New service offering", topic: "a new service we offer" },
      { label: "Health tip", topic: "a helpful health tip" },
      { label: "Patient testimonial", topic: "a recent patient testimonial" },
      { label: "New provider joining", topic: "a new member of our care team" },
      { label: "Appointment availability", topic: "current appointment availability" },
    ],
  },
  "Retail & E-commerce": {
    toneDefault: "energetic, direct, deal-forward",
    hooks: [
      "New in, and it won't last.",
      "Something new just dropped — you'll love this one.",
      "Shop smarter, starting today.",
      "This one's going to sell out fast.",
      "You know the feeling of finding exactly what you wanted.",
      "Good picks don't stick around long.",
    ],
    valueProps: [
      "{{topic}} — now available, made for how you actually shop.",
      "{{topic}} means quality without the wait.",
      "We picked {{topic}} because our customers deserve better.",
      "{{topic}} made the cut because it's the real deal.",
      "{{topic}} is exactly the kind of pick customers keep asking for.",
      "{{topic}} is here because we actually listen to what people want.",
    ],
    ctas: [
      "Shop {{topic}} at {{company}} now.",
      "Don't miss it — check out {{company}} today.",
      "Head to {{company}} before it's gone.",
      "Get it while it's here — visit {{company}} now.",
      "{{company}} has it in stock, for now.",
      "See {{topic}} for yourself at {{company}}.",
    ],
    scriptContexts: [
      "You know the feeling when you find exactly what you were looking for.",
      "Good picks don't stick around long.",
      "Shopping should feel easy, not like a chore.",
      "The best finds are usually the ones you weren't specifically looking for.",
      "Some products earn a spot on the shelf just by being genuinely good.",
      "A good pick saves you from scrolling through everything else.",
    ],
    scriptMessages: [
      "{{topic}} just landed, and it's exactly the kind of pick customers ask for.",
      "{{topic}} made the cut because it's the real deal, not just another item on a shelf.",
      "{{topic}} is what happens when you actually listen to what people want.",
      "{{topic}} is here because customers kept asking for exactly this.",
      "{{topic}} earned its spot the same way everything here does: it's actually good.",
      "{{topic}} is the kind of find that's worth telling a friend about.",
    ],
    visualTone: "Bright punchy studio lighting, bold product-forward composition, vibrant color accents",
    forbiddenStyles: ["dark moody tones", "cluttered chaotic composition", "rustic vintage textures", "flat low-contrast lighting"],
    hashtags: ["#ShopNow", "#NewArrival", "#RetailTherapy", "#LimitedStock", "#SaleAlert"],
    shortHeadlines: ["Just Dropped", "Shop The New Arrivals", "Deals Worth Sharing"],
    autoTopics: ["this season's collection", "our latest drop", "this week's lineup"],
    topicSuggestions: [
      { label: "New arrival", topic: "our newest arrival" },
      { label: "Limited-time offer", topic: "this week's limited-time offer" },
      { label: "Customer favorite", topic: "a customer favorite" },
      { label: "Restock alert", topic: "a popular restock" },
      { label: "Seasonal collection", topic: "our seasonal collection" },
    ],
  },
  "Hospitality & Food": {
    toneDefault: "warm, sensory, inviting",
    hooks: [
      "Pull up a seat — this one's been worth the wait.",
      "Some things are better shared.",
      "Made fresh, served with care.",
      "Good food is worth doing properly.",
      "This is the kind of meal people talk about after.",
      "Some places just feel like they were made for gathering.",
    ],
    valueProps: [
      "{{topic}} — made from scratch, the way it should be.",
      "{{topic}} is about the whole experience, not just the plate.",
      "{{topic}} — real ingredients, real care, every time.",
      "{{topic}} is unhurried, made fresh, and worth the seat.",
      "{{topic}} is built around real ingredients, not shortcuts.",
      "{{topic}} turns an ordinary meal into an occasion.",
    ],
    ctas: [
      "Reserve your table at {{company}} today.",
      "Come taste {{topic}} at {{company}} this week.",
      "Order from {{company}} and taste the difference.",
      "Stop by {{company}} and see for yourself.",
      "{{company}} is open — come hungry.",
      "Ask {{company}} about {{topic}} on your next visit.",
    ],
    scriptContexts: [
      "The best meals are the ones that feel like they were made just for you.",
      "Good food is worth doing properly, from the first ingredient to the last plate.",
      "Some places just feel like they were made for gathering.",
      "The right meal can turn an ordinary evening into one worth remembering.",
      "Good food rewards the people who refuse to rush it.",
      "Some flavors only happen when nobody cut a corner along the way.",
    ],
    scriptMessages: [
      "{{topic}} is made the way it should be — fresh, unhurried, and worth the seat.",
      "{{topic}} is built around real ingredients, not shortcuts.",
      "{{topic}} is proof an ordinary meal can feel like an occasion.",
      "{{topic}} comes from taking the extra step most places skip.",
      "{{topic}} is made the same careful way, whether it's a Tuesday or a celebration.",
      "{{topic}} is what happens when the kitchen refuses to rush.",
    ],
    visualTone: "Warm ambient lighting, rich food and table textures, inviting shallow depth of field",
    forbiddenStyles: ["cold clinical lighting", "neon cyberpunk", "cartoon style", "artificial plastic textures"],
    hashtags: ["#Foodie", "#EatLocal", "#MadeFresh", "#DineWithUs", "#TasteTheDifference"],
    shortHeadlines: ["Made Fresh Daily", "Pull Up A Seat", "Taste The Difference"],
    autoTopics: ["tonight's special", "our new menu", "this week's tasting menu"],
    topicSuggestions: [
      { label: "New menu item", topic: "our newest menu item" },
      { label: "Limited-time special", topic: "this week's special" },
      { label: "Behind the scenes", topic: "what happens behind the scenes" },
      { label: "Customer favorite dish", topic: "a customer favorite dish" },
      { label: "Reservation reminder", topic: "upcoming reservations" },
    ],
  },
  "Professional Services": {
    toneDefault: "clear, competent, no-nonsense",
    hooks: [
      "Expertise you can rely on.",
      "Handling the details so you don't have to.",
      "Straightforward advice, real results.",
      "The right advice at the right time changes everything.",
      "Most problems get simpler once the right person looks at them.",
      "You shouldn't need a translator for your own decisions.",
    ],
    valueProps: [
      "{{topic}} — clear guidance, no jargon, no wasted time.",
      "{{topic}} means answers you can actually act on.",
      "We bring real expertise to {{topic}}, so you can make confident decisions.",
      "{{topic}} turns a complicated problem into a clear next step.",
      "{{topic}} gets straight answers, not a runaround.",
      "{{topic}} exists because good advice shouldn't be complicated.",
    ],
    ctas: [
      "Book a consultation with {{company}} today.",
      "Get in touch with {{company}} about {{topic}}.",
      "Let {{company}} take {{topic}} off your plate.",
      "Reach out to {{company}} to get started.",
      "{{company}} is ready to help — get in touch.",
      "Talk to {{company}} about your next step.",
    ],
    scriptContexts: [
      "The right advice at the right time changes everything.",
      "Most problems get simpler once someone who knows the field looks at them.",
      "You shouldn't need a translator for your own decisions.",
      "The cost of bad advice is usually higher than the cost of good advice.",
      "A second opinion from the right person can save months of guessing.",
      "Most complicated problems just haven't met the right expertise yet.",
    ],
    scriptMessages: [
      "{{topic}} is where a complicated problem turns into a clear next step.",
      "{{topic}} gets the same approach with every client: straight answers, real expertise.",
      "{{topic}} exists because good advice shouldn't be complicated.",
      "{{topic}} means having someone in your corner who actually knows the field.",
      "{{topic}} turns uncertainty into a plan you can actually act on.",
      "{{topic}} is handled with the same rigor every client's situation deserves.",
    ],
    visualTone: "Clean minimal studio lighting, sharp geometric composition, muted confident palette",
    forbiddenStyles: ["cluttered chaotic composition", "neon cyberpunk", "whimsical cartoon style", "rustic vintage textures"],
    hashtags: ["#ProfessionalServices", "#Consulting", "#ExpertAdvice", "#TrustedPartner", "#GetInTouch"],
    shortHeadlines: ["Expertise You Can Trust", "Straight Answers, Real Results", "We Handle The Details"],
    autoTopics: ["your business planning", "your next consultation", "your compliance review"],
    topicSuggestions: [
      { label: "New service offering", topic: "a new service we offer" },
      { label: "Client testimonial", topic: "a recent client testimonial" },
      { label: "Limited-time consultation offer", topic: "a limited-time consultation offer" },
      { label: "Common question answered", topic: "a question we hear often" },
      { label: "Team spotlight", topic: "a member of our team" },
    ],
  },
  Other: {
    toneDefault: "clear, genuine, professional",
    hooks: [
      "Here's what's new.",
      "There's something worth sharing today.",
      "A quick update, straight from the team.",
      "Good work deserves a proper introduction.",
      "Every business has a story behind what it makes.",
      "Worth a closer look.",
    ],
    valueProps: [
      "{{topic}} — made with care by the whole team.",
      "{{topic}} is something we're proud of.",
      "We think you'll love what's been done with {{topic}}.",
      "{{topic}} is the kind of thing we put real thought into.",
      "{{topic}} was built to actually be useful, not just new.",
      "{{topic}} says a lot about how we do things.",
    ],
    ctas: [
      "Learn more at {{company}} today.",
      "Get in touch with {{company}} to find out more.",
      "Check out {{company}} for more on {{topic}}.",
      "Reach out to {{company}} to learn more.",
      "{{company}} would love to hear from you.",
      "Contact {{company}} about {{topic}}.",
    ],
    scriptContexts: [
      "Every business has a story behind what it makes.",
      "The details are usually where the real effort shows.",
      "Good work deserves a proper introduction.",
      "Some things are worth explaining properly instead of just announcing.",
      "The effort behind something is usually invisible until someone points it out.",
      "A real update is worth more than a dozen generic ones.",
    ],
    scriptMessages: [
      "{{topic}} is the kind of thing we put real thought into.",
      "{{topic}} was built to actually be useful, not just new.",
      "{{topic}} says a lot about how we do things.",
      "{{topic}} reflects the same care that goes into everything we make.",
      "{{topic}} is proof that the details still matter to us.",
      "{{topic}} was made with real people in mind, not just a release date.",
    ],
    visualTone: "Clean natural lighting, genuine real-world setting, balanced composition",
    forbiddenStyles: ["neon cyberpunk", "dark dystopian tones", "cartoon style", "cluttered chaotic composition"],
    hashtags: ["#SmallBusiness", "#ShopLocal", "#NewPost", "#CheckItOut", "#SupportLocal"],
    shortHeadlines: ["Something New Is Here", "Worth Sharing", "See What Is New"],
    autoTopics: ["our latest project", "this week's update", "our newest offering"],
    topicSuggestions: [
      { label: "New update", topic: "our latest update" },
      { label: "Customer story", topic: "a recent customer story" },
      { label: "Behind the scenes", topic: "what goes on behind the scenes" },
      { label: "Special offer", topic: "a special offer" },
      { label: "Team spotlight", topic: "a member of our team" },
    ],
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

// Real, confirmed-live gap (2026-09-01 acceptance test): the free/
// template tier had zero Arabic content in any industry pack — an
// Arabic-locale company with no BYOK key got fully English captions/
// scripts/campaign items regardless of locale, contradicting CLAUDE.md's
// "Arabic is first-class, not English-plus-a-translation-layer"
// requirement. Started with Real Estate alone (2026-09-02) as a
// reviewable pilot batch, then all 8 remaining industries were filled
// in together (2026-09-03) once that pilot's pattern (grammatical-
// gender safety below, tone/hashtags/topic suggestions per industry)
// was confirmed sound. All 9 industries now have real Arabic content.
// Partial<> is kept — not widened to Record<> — because it's still the
// honest type: resolveIndustryPack below falls back to the English
// pack for any industry that isn't a real key of this object, so a
// future new Industry value added to INDUSTRIES still degrades safely
// instead of a compile-time guarantee it can't actually keep.
//
// Every {{topic}}/{{company}} template here deliberately avoids making
// the placeholder the grammatical subject of a gender-agreeing verb or
// adjective (Arabic nouns are masculine/feminine and the free tier has
// no way to know which a given topic string is) — {{topic}} only ever
// appears as the object of a preposition (في/مع/عن/بخصوص) or in
// colon/dash apposition, the same "safe regardless of what fills the
// slot" discipline as the English packs' singular/mass-noun rule,
// adapted to Arabic's actual real risk (gender agreement, not
// singular/plural). {{company}} is treated as grammatically feminine
// throughout (agreeing with the implicit "الشركة") — the standard,
// natural convention in Arabic business copy.
//
// visualTone/forbiddenStyles stay in English deliberately — these
// never reach an Arabic-reading human, they're internal prompt-
// engineering text fed to an English-trained image model.
export const INDUSTRY_PACKS_AR: Partial<Record<Industry, IndustryPack>> = {
  "Real Estate": {
    toneDefault: "أنيق، طموح، جدير بالثقة",
    hooks: [
      "فصل جديد من حياتك يبدأ من هنا.",
      "ابحث عن المساحة التي تناسب حياتك.",
      "العثور على منزلك لا يجب أن يكون معقدًا.",
      "المكان المناسب موجود — دعنا نجده معًا.",
      "المنزل يجب أن يناسب الحياة التي تعيشها فعلاً.",
      "التوقيت الصحيح والمعرفة المحلية يغيران كل شيء.",
    ],
    valueProps: [
      "{{topic}}: خبرة محلية حقيقية وشفافية كاملة، من البداية حتى النهاية.",
      "مع {{topic}}، لا مفاجآت — فقط نتائج تستحق الثقة.",
      "نرافقكم خطوة بخطوة في {{topic}}، من أول معاينة حتى يوم التوقيع.",
      "في {{topic}}، يحصل كل عميل على نفس الاهتمام الصادق والدقيق.",
      "{{topic}} — نهتم بربط الناس بالمكان المناسب، لا أي مكان.",
      "نتعامل مع {{topic}} بالمعرفة المحلية التي تصنع الفرق.",
    ],
    ctas: [
      "احجز جولتك مع {{company}} اليوم.",
      "تواصل مع {{company}} لبدء رحلة البحث.",
      "اسأل {{company}} عن {{topic}} — نحن هنا للمساعدة.",
      "تواصل مع {{company}} لمعرفة المزيد.",
      "{{company}} جاهزة لمساعدتك في خطوتك القادمة.",
      "تواصل مع {{company}} بخصوص {{topic}}.",
    ],
    scriptContexts: [
      "العثور على المكان المناسب يتعلق بأكثر من مجرد المساحة.",
      "السوق يتحرك بسرعة — ووجود من يفهمه جيدًا يصنع فرقًا حقيقيًا.",
      "المنزل يجب أن يناسب الحياة التي تعيشها فعلاً.",
      "البحث عن العقار المناسب يشبه حوارًا صادقًا أكثر من كونه بحثًا متعبًا.",
      "كل عقار له قصة لا تخبرك بها الأرقام وحدها.",
      "التوقيت والمعرفة المحلية يحددان أكثر مما يتخيله أغلب المشترين.",
    ],
    scriptMessages: [
      "في {{topic}}، تتحول المعرفة المحلية إلى قرار تشعر تجاهه بالثقة.",
      "مع {{topic}}، نتولى كل التفاصيل لتتفرغ لما يهمك فعلاً.",
      "في {{topic}}، نعكس ما يهمنا أكثر: ربط الناس بالمكان المناسب، بصدق.",
      "في {{topic}}، يحصل كل عميل على نفس الدقة والاهتمام، من البداية حتى الإغلاق.",
      "{{topic}} — بالشفافية التي تحوّل البحث إلى ثقة.",
      "الهدف من {{topic}} هو إيجاد التناسب الصحيح، لا مجرد أحدث قائمة متاحة.",
    ],
    visualTone: "Polished architectural lines, natural window light, aspirational interiors and exteriors",
    forbiddenStyles: ["cluttered rooms", "cartoon style", "neon cyberpunk", "harsh overexposed lighting"],
    hashtags: ["#عقارات", "#بيت_أحلامك", "#عقار_للبيع", "#البحث_عن_منزل", "#إعلان_جديد"],
    shortHeadlines: ["فصلك القادم ينتظرك", "البداية من هنا", "جِد ما يناسبك"],
    autoTopics: ["بحثك عن منزل", "أحدث عرض لهذا الأسبوع", "خطوتك القادمة"],
    topicSuggestions: [
      { label: "عرض جديد", topic: "عرضنا الجديد" },
      { label: "بيع ناجح", topic: "عملية بيع ناجحة مؤخرًا" },
      { label: "تحديث السوق", topic: "وضع السوق الحالي" },
      { label: "إعلان بيت مفتوح", topic: "البيت المفتوح لهذا الأسبوع" },
      { label: "شهادة عميل", topic: "شهادة عميل حديثة" },
    ],
  },
  Agriculture: {
    toneDefault: "دافئ، بسيط، متجذر في الأرض والمواسم",
    hooks: [
      "من الحقل إلى مائدتكم، طازج كما يجب أن يكون.",
      "أفضل ما في الموسم جاهز الآن.",
      "من مزرعتنا إلى عائلتكم مباشرة.",
      "بعض الأشياء تستحق أن تُصنع على مهل.",
      "تربة طيبة، عمل صادق، طعام حقيقي.",
      "هكذا يكون طعم الطازج فعلاً.",
    ],
    valueProps: [
      "{{topic}} — عناية حقيقية في الزراعة، وحصاد في وقته، دون أي اختصارات.",
      "مع {{topic}}، تحصلون على جودة تشعرون بها وتثقون بها.",
      "نضع في {{topic}} نفس العناية التي نضعها في كل حصاد.",
      "{{topic}} — من تربة نعرفها ومواسم نحترمها.",
      "{{topic}} — بلا استعجال، فالطعام الجيد لا يُصنع على عجل.",
      "{{topic}} — لأن الإتقان ما زال مهمًا، مهما تغيّر الموسم.",
    ],
    ctas: [
      "زوروا {{company}} هذا الأسبوع لتذوقوا أفضل ما في الموسم.",
      "تفضلوا بزيارة {{company}} واكتشفوا فرق الطازج بأنفسكم.",
      "اسألونا في {{company}} عن {{topic}} في زيارتكم القادمة.",
      "تعالوا لزيارة {{company}} بأنفسكم هذا الأسبوع.",
      "{{company}} مفتوحة والحصاد جاهز.",
      "تواصلوا مع {{company}} لمعرفة المزيد عن {{topic}}.",
    ],
    scriptContexts: [
      "كل موسم يحمل تحدياته الخاصة — وفرصته الخاصة لفعل الصواب تجاه الأرض.",
      "الطعام الجيد تبدأ رحلته قبل وصوله إلى مائدتكم بوقت طويل.",
      "الزراعة تكافئ الصبر، ولم يكن الاختصار يومًا جزءًا من الخطة.",
      "لكل طعام حقيقي قصة، لكن قلة من الناس يرونها.",
      "العمل لا يتوقف لأنه مريح — يتوقف عندما يُنجز على الوجه الصحيح.",
      "هناك فرق بين طعام زُرع بعناية وطعام أُنتج فقط.",
    ],
    scriptMessages: [
      "في {{topic}}، نتّبع أساليب صقلتها سنوات من العمل في هذه الأرض، لا موسم واحد على عجل.",
      "وضع اسمنا على {{topic}} وعدٌ بالطريقة التي زُرع بها.",
      "{{topic}} — بنفس المعيار الذي يحصل عليه كل حصاد، موسمًا بعد موسم.",
      "الهدف من {{topic}} واحد: معيار واحد لكل حصاد، بلا استثناء.",
      "لا بديل عن الطريقة الصادقة في {{topic}}، من البداية حتى النهاية.",
      "وراء {{topic}} صبرٌ وخبرة التقيا بأرض حقيقية.",
    ],
    visualTone: "Warm natural sunlight, organic textures, wide open fields, golden-hour lighting",
    forbiddenStyles: ["neon cyberpunk", "futuristic sci-fi", "dark dystopian tones", "urban concrete backdrops"],
    hashtags: ["#زراعة", "#طازج_من_المزرعة", "#مزرعة_محلية", "#حصاد", "#ادعم_المحلي"],
    shortHeadlines: ["طازج من حقولنا", "حُصد بعناية", "دائمًا بجودة عالية"],
    autoTopics: ["حصاد هذا الأسبوع", "منتجاتنا الموسمية", "مختاراتنا الطازجة"],
    topicSuggestions: [
      { label: "حصاد جديد", topic: "حصادنا الجديد" },
      { label: "تحديث المخزون الموسمي", topic: "مخزون هذا الموسم" },
      { label: "قصة نجاح عميل", topic: "قصة نجاح عميل مؤخرًا" },
      { label: "ممارسات الزراعة المستدامة", topic: "ممارساتنا الزراعية المستدامة" },
      { label: "تعرفوا على الفريق", topic: "الفريق وراء مزرعتنا" },
    ],
  },
  "Construction & Engineering": {
    toneDefault: "واثق، دقيق، يركز على السلامة والإتقان",
    hooks: [
      "يُبنى بإتقان، ويدوم طويلاً.",
      "مشروع جديد، ومعيار لا يتغير.",
      "من المخطط إلى التنفيذ، المعيار لا يتزحزح.",
      "الدقة ليست خيارًا — إنها كل العمل.",
      "كل مشروع يحصل على نفس الانضباط، من البداية حتى النهاية.",
      "التفاصيل التي لا يراها أحد هي التي نهتم بها أكثر.",
    ],
    valueProps: [
      "{{topic}} — يُنفَّذ بدقة هندسية، ويُسلَّم في موعده، دائمًا.",
      "مع {{topic}}، معايير صارمة من اليوم الأول وحتى التسليم.",
      "نضع السلامة والإتقان والالتزام بالمواعيد في صميم {{topic}}.",
      "{{topic}} — يُفحص ويُراجع مرارًا، دون أي تهاون.",
      "{{topic}} — بنفس المعيار سواء كان هناك من يراقب أم لا.",
      "{{topic}} — لأن القاعدة بسيطة: نبنيه مرة واحدة، ونبنيه بشكل صحيح.",
    ],
    ctas: [
      "تحدثوا مع {{company}} بخصوص مشروعكم القادم.",
      "احصلوا على عرض سعر من {{company}} اليوم.",
      "اكتشفوا كيف يمكن لـ{{company}} تنفيذ {{topic}}.",
      "تواصلوا مع {{company}} لبدء الحديث.",
      "{{company}} جاهزة عندما يكون مشروعكم جاهزًا.",
      "تواصلوا مع {{company}} للحديث عن {{topic}}.",
    ],
    scriptContexts: [
      "كل مبنى يبدأ بخطة — وبانضباط الالتزام بها حتى النهاية.",
      "الفرق بين البناء الجيد والبناء المتميز يكمن في التفاصيل التي لا يراها أغلب الناس.",
      "المواعيد النهائية والمعايير لا يجب أن تكونا مقايضة.",
      "يكفي أن يفشل مبنى مرة واحدة ليثبت أهمية المعايير.",
      "أفضل الأعمال تبدو بسيطة لأن الجزء الصعب حدث قبل أن يراه أحد.",
      "كل مشروع يختبر الأمر نفسه: هل تصمد الخطة أمام الواقع.",
    ],
    scriptMessages: [
      "في {{topic}}، اتبعنا نفس التخطيط الدقيق والفحص الذي يحصل عليه كل مشروع.",
      "من أول مخطط وحتى الجولة النهائية، يظل المعيار في {{topic}} واحدًا.",
      "{{topic}} — بالطريقة نفسها التي يُنفَّذ بها كل وعد نقطعه.",
      "الهدف من {{topic}} واحد: تنفيذ صحيح من المرة الأولى، لا إصلاح لاحق.",
      "كل مرحلة في {{topic}} تخضع لنفس الانضباط، من الأساسات حتى التسليم.",
      "وراء {{topic}} نفس الفحوصات التي يخضع لها كل مشروع، بلا استثناء.",
    ],
    visualTone: "Clean industrial lines, steel and concrete textures, dramatic directional light, structured geometry",
    forbiddenStyles: ["whimsical cartoon style", "pastel soft-focus", "organic wilderness", "cluttered chaotic composition"],
    hashtags: ["#إنشاءات", "#هندسة", "#بناء_يدوم", "#إدارة_مشاريع", "#إتقان"],
    shortHeadlines: ["يُبنى ليدوم", "دقة تثقون بها", "معيار لا يتغير"],
    autoTopics: ["مشروعنا الأخير", "مشروعكم القادم", "هذا المشروع الحالي"],
    topicSuggestions: [
      { label: "إنجاز مرحلة من المشروع", topic: "آخر إنجاز في مشروعنا" },
      { label: "تحديث حول السلامة", topic: "معايير السلامة لدينا" },
      { label: "عرض قبل وبعد", topic: "تحول حديث قبل وبعد" },
      { label: "معدات أو قدرات جديدة", topic: "أحدث معداتنا" },
      { label: "شهادة عميل", topic: "شهادة عميل حديثة" },
    ],
  },
  Education: {
    toneDefault: "مشجّع، احترافي، يركز على النمو",
    hooks: [
      "لكل متعلم شرارة — ونحن نساعدها على النمو.",
      "تعليم يصل إلى كل طالب أينما كان.",
      "الإيمان بما يمكن أن يصبح عليه طفلكم — من هنا تبدأ الرحلة.",
      "التقدم الحقيقي يبدو مختلفًا لكل طالب.",
      "الثقة تُبنى درسًا تلو الآخر.",
      "الدعم المناسب يغيّر ما هو ممكن.",
    ],
    valueProps: [
      "{{topic}} — بأسلوب شخصي وداعم، مبني على تقدم حقيقي.",
      "مع {{topic}}، الهدف بناء الثقة، لا مجرد إنهاء المنهج.",
      "نضع إمكانات كل طالب في صميم {{topic}}.",
      "{{topic}} — يلتقي كل طالب حيث هو فعلاً، لا حيث يفترض جدول ما.",
      "{{topic}} — يُقاس بالفهم الحقيقي، لا فقط بالواجبات المنجزة.",
      "{{topic}} — لأن التقدم الحقيقي هو الهدف الوحيد.",
    ],
    ctas: [
      "احجزوا حصة تجريبية مجانية في {{company}} اليوم.",
      "سجّلوا الآن وشاهدوا الفرق مع {{company}}.",
      "تحدثوا مع فريقنا في {{company}} عن {{topic}}.",
      "تواصلوا مع {{company}} للبدء.",
      "{{company}} لديها مقاعد متاحة هذا الفصل.",
      "تواصلوا مع {{company}} لمعرفة المزيد عن {{topic}}.",
    ],
    scriptContexts: [
      "كل طالب يتعلم بطريقته الخاصة — والدعم المناسب يصنع كل الفرق.",
      "التقدم لا يبدو دائمًا كما نتوقع.",
      "الثقة تُبنى بانتصار حقيقي واحد في كل مرة.",
      "لحظة فهم واحدة يمكن أن تغيّر نظرة الطالب لنفسه.",
      "التعلم الحقيقي نادرًا ما يسير في خط مستقيم، وهذا بالضبط ما يجعله حقيقيًا.",
      "الدعم الذي يناسب الطالب فعلاً يبدو مختلفًا مع كل طالب.",
    ],
    scriptMessages: [
      "في {{topic}}، نصمم الدعم حول الطريقة التي يتعلم بها كل طالب فعلاً، لا خطة واحدة تناسب الجميع.",
      "الهدف من {{topic}} تحويل الانتصارات الصغيرة إلى ثقة تدوم.",
      "مع {{topic}}، يحصل كل طالب على الدعم لينمو بوتيرته الخاصة، خطوة بخطوة.",
      "في {{topic}}، نلتقي الطالب حيث هو فعلاً، لا حيث تفترض المناهج.",
      "{{topic}} — مبني على فكرة أن التقدم الحقيقي يستحق صبرًا حقيقيًا.",
      "في {{topic}}، يتحول الفهم إلى شيء يحمله الطالب معه إلى الأمام.",
    ],
    visualTone: "Bright even lighting, clean modern spaces, optimistic open composition",
    forbiddenStyles: ["dark moody tones", "neon cyberpunk", "cluttered chaotic composition", "unsettling imagery"],
    hashtags: ["#تعليم", "#تعلّم", "#نجاح_الطلاب", "#سجل_الآن", "#العودة_للمدارس"],
    shortHeadlines: ["تعلّم يبقى أثره", "الثقة تبدأ هنا", "خطوتكم القادمة للأمام"],
    autoTopics: ["رحلة تعلّم طفلكم", "برنامج هذا الفصل", "دروسنا الجماعية الصغيرة"],
    topicSuggestions: [
      { label: "إطلاق برنامج جديد", topic: "برنامجنا الجديد" },
      { label: "قصة نجاح طالب", topic: "قصة نجاح طالب مؤخرًا" },
      { label: "تذكير بالتسجيل", topic: "التسجيل المفتوح" },
      { label: "تعرفوا على المعلم", topic: "أحد معلمينا" },
      { label: "جدول الفصل القادم", topic: "جدول الفصل القادم" },
    ],
  },
  Healthcare: {
    toneDefault: "هادئ، مطمئن، قائم على العلم",
    hooks: [
      "صحتكم، في أيدٍ أمينة.",
      "رعاية تُصغي أولاً.",
      "معكم في كل خطوة من رعايتكم.",
      "اهتمام حقيقي، لا موعد متسرّع.",
      "الوقاية تبدأ بأن يُستمع إليكم.",
      "الثقة تُكتسب زيارة تلو الأخرى.",
    ],
    valueProps: [
      "{{topic}} — بالاهتمام والخبرة التي تستحقونها.",
      "مع {{topic}}، نبدأ بالإصغاء لكم فعلاً.",
      "نأخذ {{topic}} على محمل الجد، لتشعروا بالثقة تجاه رعايتكم.",
      "{{topic}} — وقت حقيقي مع من يعرف تاريخكم الصحي.",
      "{{topic}} — يُدار بعناية، دون تخمين أو اختصارات.",
      "{{topic}} — بنفس الاهتمام الذي يستحقه كل مريض.",
    ],
    ctas: [
      "احجزوا موعدًا مع {{company}} اليوم.",
      "تواصلوا مع {{company}} لمعرفة المزيد عن {{topic}}.",
      "صحتكم تهمنا — تحدثوا مع {{company}} اليوم.",
      "تواصلوا مع {{company}} لحجز زيارتكم.",
      "{{company}} لديها مواعيد متاحة هذا الأسبوع.",
      "تواصلوا مع {{company}} بخصوص {{topic}}.",
    ],
    scriptContexts: [
      "الرعاية الجيدة تبدأ بالإصغاء، لا بالتسرّع.",
      "قرارات الصحة تبدو مختلفة عندما تثقون بمن يوجهها.",
      "الوقاية والاهتمام يحققان أكثر مما يتوقعه أغلب الناس.",
      "أفضل رعاية غالبًا ما تبدأ بسؤال لم يكلف أحد نفسه طرحه من قبل.",
      "الثقة الحقيقية في الرعاية الصحية تُبنى زيارة بعد زيارة، لا تُفترض.",
      "اهتمام صغير ومستمر يمنع أكثر مما يمنعه تدخل كبير واحد.",
    ],
    scriptMessages: [
      "في {{topic}}، نمنحكم وقتًا واهتمامًا حقيقيين، لا موعدًا متسرعًا.",
      "مع {{topic}}، نتبع نفس الأسلوب الذي يستحقه كل مريض: بعناية، ودون تخمين.",
      "{{topic}} — جزء من الطريقة التي تُكتسب بها الثقة، زيارة تلو الأخرى.",
      "في {{topic}}، نبدأ بالإصغاء، لا بافتراض ما تحتاجونه.",
      "{{topic}} — بمعيار واحد بسيط: اهتمام حقيقي في كل زيارة.",
      "في {{topic}}، يحصل كل مريض على نفس الجدية التي تستحقها رعايته.",
    ],
    visualTone: "Soft even clinical-clean lighting, calm neutral tones, gentle depth of field",
    forbiddenStyles: ["dark horror tones", "neon cyberpunk", "chaotic cluttered scenes", "graphic medical imagery"],
    hashtags: ["#رعاية_صحية", "#صحة", "#رحلة_العافية", "#حياة_صحية", "#احجز_الآن"],
    shortHeadlines: ["رعاية تُصغي إليكم", "صحتكم أولويتنا", "ثقة في كل زيارة"],
    autoTopics: ["خطة رعايتكم", "زيارتكم القادمة", "الرعاية الوقائية"],
    topicSuggestions: [
      { label: "خدمة جديدة", topic: "خدمة جديدة نقدمها" },
      { label: "نصيحة صحية", topic: "نصيحة صحية مفيدة" },
      { label: "شهادة مريض", topic: "شهادة مريض حديثة" },
      { label: "انضمام طبيب جديد", topic: "عضو جديد في فريق الرعاية" },
      { label: "مواعيد متاحة", topic: "المواعيد المتاحة حاليًا" },
    ],
  },
  "Retail & E-commerce": {
    toneDefault: "نشيط، مباشر، يركز على العروض",
    hooks: [
      "وصل حديثًا، ولن يدوم طويلاً.",
      "شيء جديد وصل للتو — ستحبونه.",
      "تسوّقوا بذكاء، ابتداءً من اليوم.",
      "هذا سينفد بسرعة.",
      "تعرفون ذلك الشعور حين تجدون بالضبط ما كنتم تبحثون عنه.",
      "الاختيارات الجيدة لا تبقى طويلاً.",
    ],
    valueProps: [
      "{{topic}} — متوفر الآن، وصُمم ليناسب طريقة تسوقكم فعلاً.",
      "مع {{topic}}، الجودة بلا انتظار.",
      "اخترنا {{topic}} لأن عملاءنا يستحقون الأفضل.",
      "{{topic}} — دخل مجموعتنا لأنه فعلاً يستحق ذلك.",
      "{{topic}} — بالضبط ما يطلبه عملاؤنا باستمرار.",
      "{{topic}} — موجود لأننا نصغي فعلاً لما يريده الناس.",
    ],
    ctas: [
      "تسوقوا {{topic}} من {{company}} الآن.",
      "لا تفوتوا الفرصة — تصفحوا {{company}} اليوم.",
      "توجهوا إلى {{company}} قبل نفاد الكمية.",
      "احصلوا عليه الآن — زوروا {{company}}.",
      "{{company}} لديها الكمية متوفرة، حاليًا.",
      "شاهدوا {{topic}} بأنفسكم في {{company}}.",
    ],
    scriptContexts: [
      "تعرفون ذلك الشعور حين تجدون بالضبط ما كنتم تبحثون عنه.",
      "الاختيارات الجيدة لا تبقى طويلاً.",
      "التسوق يجب أن يكون سهلاً، لا مهمة مرهقة.",
      "أفضل الاكتشافات غالبًا ما تكون تلك التي لم تكونوا تبحثون عنها تحديدًا.",
      "بعض المنتجات تكسب مكانها على الرف بمجرد أنها جيدة فعلاً.",
      "اختيار جيد يوفر عليكم تصفح كل شيء آخر.",
    ],
    scriptMessages: [
      "{{topic}} وصل للتو، وهو بالضبط النوع الذي يطلبه عملاؤنا.",
      "{{topic}} دخل مجموعتنا لأنه فعلاً يستحق ذلك، لا لمجرد منتج آخر على الرف.",
      "في {{topic}}، نصغي فعلاً لما يريده الناس.",
      "{{topic}} موجود لأن عملاءنا طلبوه تحديدًا.",
      "وراء {{topic}} نفس المعيار الذي يحصل عليه كل شيء هنا: أنه جيد فعلاً.",
      "{{topic}} من النوع الذي يستحق أن تخبروا عنه صديقًا.",
    ],
    visualTone: "Bright punchy studio lighting, bold product-forward composition, vibrant color accents",
    forbiddenStyles: ["dark moody tones", "cluttered chaotic composition", "rustic vintage textures", "flat low-contrast lighting"],
    hashtags: ["#تسوق_الآن", "#وصل_حديثًا", "#عروض", "#كمية_محدودة", "#تنبيه_تخفيضات"],
    shortHeadlines: ["وصل للتو", "تسوقوا الجديد", "عروض تستحق المشاركة"],
    autoTopics: ["مجموعة هذا الموسم", "أحدث وصولاتنا", "تشكيلة هذا الأسبوع"],
    topicSuggestions: [
      { label: "وصول جديد", topic: "أحدث وصول لدينا" },
      { label: "عرض محدود", topic: "عرض هذا الأسبوع المحدود" },
      { label: "المفضل لدى العملاء", topic: "منتج مفضل لدى العملاء" },
      { label: "تنبيه إعادة تخزين", topic: "إعادة تخزين منتج رائج" },
      { label: "مجموعة موسمية", topic: "مجموعتنا الموسمية" },
    ],
  },
  "Hospitality & Food": {
    toneDefault: "دافئ، حسّي، مرحّب",
    hooks: [
      "تفضلوا بالجلوس — كان الانتظار يستحق العناء.",
      "بعض الأشياء أجمل حين تُشارَك.",
      "يُحضَّر طازجًا، ويُقدَّم بعناية.",
      "الطعام الجيد يستحق أن يُصنع كما يجب.",
      "هذه هي الوجبة التي سيتحدث عنها الناس لاحقًا.",
      "بعض الأماكن كأنها صُنعت للاجتماع فيها.",
    ],
    valueProps: [
      "{{topic}} — يُحضَّر من الصفر، كما يجب أن يكون.",
      "مع {{topic}}، التجربة كاملة، لا الطبق وحده.",
      "{{topic}} — مكونات حقيقية، وعناية حقيقية، في كل مرة.",
      "{{topic}} — بلا استعجال، طازج، ويستحق المقعد.",
      "{{topic}} — مبني على مكونات حقيقية، لا اختصارات.",
      "{{topic}} — يحوّل وجبة عادية إلى مناسبة.",
    ],
    ctas: [
      "احجزوا طاولتكم في {{company}} اليوم.",
      "تعالوا لتذوق {{topic}} في {{company}} هذا الأسبوع.",
      "اطلبوا من {{company}} وتذوقوا الفرق.",
      "تفضلوا بزيارة {{company}} واكتشفوا بأنفسكم.",
      "{{company}} مفتوحة — تفضلوا جائعين.",
      "اسألوا {{company}} عن {{topic}} في زيارتكم القادمة.",
    ],
    scriptContexts: [
      "أفضل الوجبات هي تلك التي تشعرون وكأنها صُنعت خصيصًا لكم.",
      "الطعام الجيد يستحق أن يُصنع كما يجب، من أول مكوّن حتى آخر طبق.",
      "بعض الأماكن كأنها صُنعت للاجتماع فيها.",
      "الوجبة المناسبة يمكن أن تحوّل مساءً عاديًا إلى ذكرى تُروى.",
      "الطعام الجيد يكافئ من يرفض الاستعجال.",
      "بعض النكهات لا تحدث إلا حين لا يختصر أحد الطريق.",
    ],
    scriptMessages: [
      "في {{topic}}، نحضّر كل شيء كما يجب أن يكون: طازجًا وبلا استعجال.",
      "{{topic}} — مبني على مكونات حقيقية، لا اختصارات.",
      "في {{topic}}، نثبت أن الوجبة العادية يمكن أن تصبح مناسبة.",
      "{{topic}} — بالخطوة الإضافية التي تتخطاها أغلب الأماكن.",
      "نحضّر {{topic}} بنفس العناية سواء كان يوم عادي أو مناسبة احتفال.",
      "{{topic}} — من مطبخ يرفض الاستعجال.",
    ],
    visualTone: "Warm ambient lighting, rich food and table textures, inviting shallow depth of field",
    forbiddenStyles: ["cold clinical lighting", "neon cyberpunk", "cartoon style", "artificial plastic textures"],
    hashtags: ["#مطاعم", "#طعام_محلي", "#طازج_دائمًا", "#تناولوا_معنا", "#فرق_النكهة"],
    shortHeadlines: ["يُحضَّر طازجًا يوميًا", "تفضلوا بالجلوس", "تذوقوا الفرق"],
    autoTopics: ["طبق اليوم المميز", "قائمة طعامنا الجديدة", "قائمة تذوق هذا الأسبوع"],
    topicSuggestions: [
      { label: "طبق جديد في القائمة", topic: "أحدث طبق في قائمتنا" },
      { label: "عرض محدود", topic: "عرض هذا الأسبوع" },
      { label: "خلف الكواليس", topic: "ما يحدث خلف الكواليس" },
      { label: "طبق مفضل لدى العملاء", topic: "طبق مفضل لدى عملائنا" },
      { label: "تذكير بالحجوزات", topic: "الحجوزات القادمة" },
    ],
  },
  "Professional Services": {
    toneDefault: "واضح، كفؤ، بلا مبالغات",
    hooks: [
      "خبرة يمكنكم الاعتماد عليها.",
      "نتولى التفاصيل عنكم.",
      "نصيحة مباشرة، ونتائج حقيقية.",
      "النصيحة الصحيحة في الوقت الصحيح تغيّر كل شيء.",
      "أغلب المشاكل تصبح أبسط حين ينظر إليها الشخص المناسب.",
      "لا يجب أن تحتاجوا مترجمًا لفهم قراراتكم الخاصة.",
    ],
    valueProps: [
      "{{topic}} — إرشاد واضح، بلا تعقيد، وبلا إهدار للوقت.",
      "مع {{topic}}، الإجابات قابلة للتنفيذ فعلاً.",
      "نجلب خبرة حقيقية إلى {{topic}}، لتتخذوا قراراتكم بثقة.",
      "{{topic}} — يحوّل مشكلة معقدة إلى خطوة واضحة.",
      "{{topic}} — إجابات مباشرة، لا مماطلة.",
      "{{topic}} — لأن النصيحة الجيدة لا يجب أن تكون معقدة.",
    ],
    ctas: [
      "احجزوا استشارة مع {{company}} اليوم.",
      "تواصلوا مع {{company}} بخصوص {{topic}}.",
      "دعوا {{company}} تتولى {{topic}} عنكم.",
      "تواصلوا مع {{company}} للبدء.",
      "{{company}} جاهزة لمساعدتكم — تواصلوا معنا.",
      "تحدثوا مع {{company}} عن خطوتكم القادمة.",
    ],
    scriptContexts: [
      "النصيحة الصحيحة في الوقت الصحيح تغيّر كل شيء.",
      "أغلب المشاكل تصبح أبسط حين ينظر إليها من يفهم المجال.",
      "لا يجب أن تحتاجوا مترجمًا لفهم قراراتكم الخاصة.",
      "تكلفة النصيحة السيئة عادة أعلى من تكلفة النصيحة الجيدة.",
      "رأي ثانٍ من الشخص المناسب قد يوفر أشهرًا من التخمين.",
      "أغلب المشاكل المعقدة لم تلتقِ بعد بالخبرة المناسبة.",
    ],
    scriptMessages: [
      "في {{topic}}، نحوّل مشكلة معقدة إلى خطوة واضحة تستطيعون تنفيذها.",
      "في {{topic}}، نتبع نفس النهج مع كل عميل: إجابات مباشرة، وخبرة حقيقية.",
      "{{topic}} — لأن النصيحة الجيدة لا يجب أن تكون معقدة.",
      "مع {{topic}}، لديكم من يفهم المجال فعلاً في صفكم.",
      "في {{topic}}، نحوّل الغموض إلى خطة يمكنكم التصرف بموجبها فعلاً.",
      "نتعامل مع {{topic}} بنفس الدقة التي يستحقها موقف كل عميل.",
    ],
    visualTone: "Clean minimal studio lighting, sharp geometric composition, muted confident palette",
    forbiddenStyles: ["cluttered chaotic composition", "neon cyberpunk", "whimsical cartoon style", "rustic vintage textures"],
    hashtags: ["#خدمات_مهنية", "#استشارات", "#نصيحة_خبير", "#شريك_موثوق", "#تواصلوا_معنا"],
    shortHeadlines: ["خبرة تثقون بها", "إجابات مباشرة، نتائج حقيقية", "نتولى التفاصيل عنكم"],
    autoTopics: ["تخطيط أعمالكم", "استشارتكم القادمة", "مراجعة الامتثال لديكم"],
    topicSuggestions: [
      { label: "خدمة جديدة", topic: "خدمة جديدة نقدمها" },
      { label: "شهادة عميل", topic: "شهادة عميل حديثة" },
      { label: "عرض استشارة محدود", topic: "عرض استشارة لفترة محدودة" },
      { label: "سؤال شائع", topic: "سؤال نسمعه كثيرًا" },
      { label: "تعرفوا على الفريق", topic: "أحد أعضاء فريقنا" },
    ],
  },
  Other: {
    toneDefault: "واضح، صادق، احترافي",
    hooks: [
      "إليكم آخر الجديد.",
      "هناك ما يستحق المشاركة اليوم.",
      "تحديث سريع، مباشرة من الفريق.",
      "العمل الجيد يستحق تقديمًا لائقًا.",
      "لكل عمل قصة وراء ما يصنعه.",
      "يستحق نظرة أقرب.",
    ],
    valueProps: [
      "{{topic}} — صُنع بعناية من الفريق بأكمله.",
      "{{topic}} — شيء نفخر به فعلاً.",
      "نعتقد أنكم ستحبون ما تم صنعه في {{topic}}.",
      "{{topic}} — وضعنا فيه تفكيرًا حقيقيًا، لا مجرد جديد.",
      "{{topic}} — صُمم ليكون مفيدًا فعلاً، لا مجرد إضافة.",
      "{{topic}} — يعكس الكثير عن طريقة عملنا.",
    ],
    ctas: [
      "اعرفوا المزيد من {{company}} اليوم.",
      "تواصلوا مع {{company}} لمعرفة المزيد.",
      "تعرفوا على {{company}} لمزيد عن {{topic}}.",
      "تواصلوا مع {{company}} للتعرف أكثر.",
      "{{company}} يسعدها التواصل معكم.",
      "تواصلوا مع {{company}} بخصوص {{topic}}.",
    ],
    scriptContexts: [
      "لكل عمل قصة وراء ما يصنعه.",
      "التفاصيل عادة ما تكون حيث يظهر الجهد الحقيقي.",
      "العمل الجيد يستحق تقديمًا لائقًا.",
      "بعض الأشياء تستحق شرحًا حقيقيًا بدل مجرد إعلان.",
      "الجهد وراء أي شيء عادة ما يكون غير مرئي حتى يشير إليه أحد.",
      "تحديث حقيقي واحد يساوي أكثر من عشرة عامة.",
    ],
    scriptMessages: [
      "{{topic}} — وضعنا فيه تفكيرًا حقيقيًا.",
      "في {{topic}}، هدفنا أن يكون مفيدًا فعلاً، لا مجرد جديد.",
      "{{topic}} — يعكس الكثير عن طريقة عملنا.",
      "في {{topic}}، نتبع نفس العناية التي نضعها في كل ما نصنعه.",
      "{{topic}} — بنفس الاهتمام الذي لا يزال يهمنا في كل شيء.",
      "في {{topic}}، فكرنا بأشخاص حقيقيين، لا مجرد موعد إطلاق.",
    ],
    visualTone: "Clean natural lighting, genuine real-world setting, balanced composition",
    forbiddenStyles: ["neon cyberpunk", "dark dystopian tones", "cartoon style", "cluttered chaotic composition"],
    hashtags: ["#أعمال_محلية", "#تسوقوا_محليًا", "#منشور_جديد", "#اطّلعوا_علينا", "#ادعم_المحلي"],
    shortHeadlines: ["شيء جديد هنا", "يستحق المشاركة", "اكتشفوا الجديد"],
    autoTopics: ["مشروعنا الأخير", "تحديث هذا الأسبوع", "أحدث ما نقدمه"],
    topicSuggestions: [
      { label: "تحديث جديد", topic: "آخر تحديث لدينا" },
      { label: "قصة عميل", topic: "قصة عميل مؤخرًا" },
      { label: "خلف الكواليس", topic: "ما يجري خلف الكواليس" },
      { label: "عرض خاص", topic: "عرض خاص" },
      { label: "تعرفوا على الفريق", topic: "أحد أعضاء فريقنا" },
    ],
  },
};

// Company.primaryIndustry is a plain DB string column, not narrowed to
// the Industry union — the same defensive resolution
// src/lib/company-context.ts already used (falls back to "Other" for
// any value that isn't a currently-known industry, e.g. stale data),
// extracted here so every caller that only needs the pack (not the
// full CompanyContext) shares the identical real logic instead of
// each re-implementing its own cast.
const KNOWN_INDUSTRIES = new Set(Object.keys(INDUSTRY_PACKS));

export function resolveIndustry(rawIndustry: string): Industry {
  return KNOWN_INDUSTRIES.has(rawIndustry) ? (rawIndustry as Industry) : "Other";
}

// locale defaults to "EN" so every existing caller (UI pages that
// don't yet pass a company's locale) keeps its exact prior behavior —
// only callers that opt in by passing "AR" can get a real Arabic pack,
// and even then only for an industry INDUSTRY_PACKS_AR actually covers
// (see its own doc comment for the honest fallback rule).
export function resolveIndustryPack(rawIndustry: string, locale: "EN" | "AR" = "EN"): IndustryPack {
  const industry = resolveIndustry(rawIndustry);
  if (locale === "AR") {
    const arabicPack = INDUSTRY_PACKS_AR[industry];
    if (arabicPack) return arabicPack;
  }
  return INDUSTRY_PACKS[industry];
}
