import type { Locale } from "@/lib/i18n/dictionaries";

// Part 3's real help content — plain-language, for a busy non-
// technical business owner, not developer docs. Every claim here is
// checked against what the app actually does today (grep'd before
// writing, not assumed) — CLAUDE.md's "no fake functionality" rule
// applies to documentation too: don't promise a platform or feature
// that isn't real yet.
export interface HelpSection {
  id: string;
  title: string;
  body: string[];
}

export interface HelpContent {
  pageTitle: string;
  pageIntro: string;
  sections: HelpSection[];
}

export const HELP_CONTENT: Record<Locale, HelpContent> = {
  en: {
    pageTitle: "Help",
    pageIntro: "Plain answers to the most common questions. No technical background needed.",
    sections: [
      {
        id: "getting-started",
        title: "Getting started",
        body: [
          "When you sign up, the fastest way to set up your company is to paste your website address — Postify reads your homepage and fills in your business description, likely products, and tone of voice automatically. You can review and edit everything it finds before saving.",
          "Don't have a website, or prefer to type it yourself? Choose \"set up manually\" instead — it's the same short form, just starting blank.",
          "Either way, you'll pick a primary industry (and optionally a few secondary ones, like Agriculture + B2B) and, if you like, upload your logo and brand colors in Brand Kit. That's it — you're ready to generate your first poster or video from Create Content.",
        ],
      },
      {
        id: "templates-vs-ai",
        title: "Templates, Free AI, and your own API key (BYOK) — what's the difference?",
        body: [
          "Every feature in Postify works for free, with no setup. Captions, posters, and videos are built from real templates tailored to your industry and brand — never random filler text.",
          '"Free AI" goes a step further for text: when it\'s available, Postify uses a shared, no-cost AI model to write more natural captions, scripts, and campaign ideas instead of the fixed templates. You don\'t need an account or a key for this — it just works when there\'s capacity.',
          'BYOK ("bring your own key") is for when you want the highest quality: paste your own API key from a provider like OpenAI, Anthropic, or Google in Settings, and Postify uses your key for that capability (text, images, voice, or music) instead of the free tier. Your key is stored securely and only ever used on your company\'s own requests — it never touches the browser or gets logged.',
          "If a provider you've connected has a problem (an expired key, a temporary outage), Postify automatically falls back to the next best option — usually the free tier — rather than failing your generation outright. You'll see a note on the result saying which one was actually used.",
        ],
      },
      {
        id: "social-accounts",
        title: "Connecting social accounts",
        body: [
          "In Settings → Publishing, you can choose how content actually gets posted. \"Manual\" is the default and always available: you download the finished image or video and post it yourself, however you normally would.",
          "For Facebook and Instagram, Postify can publish directly on your behalf once you connect your account — this is a real, live integration, not a placeholder.",
          "Other platforms (LinkedIn, TikTok, and more) can be connected through a social-aggregator service using your own API credentials for that service, if you have one. Postify is honest about which platforms are actually live for direct publishing versus which need this extra step — check Settings for the current, real status of each.",
        ],
      },
      {
        id: "media-library",
        title: "Using the Media Library",
        body: [
          "Every photo, video, and logo you upload — plus everything Postify generates for you — lives in your private Media Library. Nothing you upload is ever visible to other companies using Postify.",
          "You can search in plain language, like \"our July farm photos\" or \"latest site visit,\" instead of digging through folders.",
          "Postify prefers your real photos and videos over generated ones whenever it can — it will never invent a fake version of your actual product, building, or team when a real photo already exists in your library. AI-generated visuals are only ever used to fill gaps (background scenes, supporting footage), not to replace what's real.",
        ],
      },
      {
        id: "creative-dna",
        title: "Creative DNA and Teach AI",
        body: [
          "Creative DNA is what Postify quietly learns about your business over time — which topics, templates, and styles you tend to keep and publish versus delete or skip. You don't have to do anything for this to work; it's based on your normal day-to-day use.",
          "You can see exactly what it's noticed, and why, in Settings. If something's wrong, you can lock a topic's score so it stops changing, or reset everything learned so far and start over — your real published-post performance history is never affected by a reset.",
          "Teach AI lets you go further and tell Postify directly: mark an existing poster or video \"more like this\" or \"never like this,\" or upload an outside example and tell us what it represents. A single mark won't swing anything by itself — Postify waits for a real pattern (several consistent signals) before it changes what it suggests, the same caution it uses for everything else it learns.",
        ],
      },
      {
        id: "campaigns",
        title: "Campaigns and recurring plans",
        body: [
          "A Campaign plans several days of content at once around one goal — for example, a product launch or seasonal sale — so each day builds on the last instead of repeating the same idea.",
          "A Recurring Plan is a standing rule instead of a one-time request: tell Postify how many videos and posts you want each day and when to publish them, and it keeps generating (and, if you choose, publishing) automatically until you pause it.",
          "Recurring plans currently run once a day (not continuously), so scheduled publish times are honored on that daily cycle rather than to-the-minute — Postify tells you this plainly in the plan settings rather than promising more precision than it can actually deliver.",
        ],
      },
      {
        id: "troubleshooting",
        title: "Troubleshooting",
        body: [
          '"Generation failed" or an unfamiliar provider error: try again — Postify already tries several fallback options automatically first, so a repeat failure usually means a temporary outage upstream. If it keeps happening, check Settings for a red/expired credential.',
          "A scheduled post didn't go out on time: check Publish for the real reason (an expired social-account connection is the most common cause) and retry it directly from there.",
          "Something looks wrong in Arabic (text direction, layout): please report it — Arabic is meant to be fully correct, not just translated, so this is treated as a real bug, not a known limitation.",
          "Still stuck? Check the specific page's own on-screen guidance first (most forms explain what went wrong right where it happened) — most issues are resolved right there without needing this page.",
        ],
      },
    ],
  },
  ar: {
    pageTitle: "المساعدة",
    pageIntro: "إجابات واضحة لأكثر الأسئلة شيوعًا. لا حاجة لأي خلفية تقنية.",
    sections: [
      {
        id: "getting-started",
        title: "البدء",
        body: [
          "عند التسجيل، أسرع طريقة لإعداد شركتك هي لصق عنوان موقعك الإلكتروني — يقرأ Postify صفحتك الرئيسية ويملأ وصف عملك ومنتجاتك المحتملة ونبرة صوتك تلقائيًا. يمكنك مراجعة وتعديل كل ما يجده قبل الحفظ.",
          "ليس لديك موقع إلكتروني، أو تفضل كتابة البيانات بنفسك؟ اختر \"الإعداد يدويًا\" بدلاً من ذلك — نفس النموذج القصير، لكن يبدأ فارغًا.",
          "في الحالتين، ستختار مجال عملك الأساسي (واختياريًا بضعة مجالات فرعية، مثل الزراعة + B2B)، وإن أردت، يمكنك رفع شعارك وألوان علامتك التجارية في \"عدة العلامة التجارية\". هذا كل شيء — أصبحت جاهزًا لإنشاء أول ملصق أو فيديو من صفحة إنشاء المحتوى.",
        ],
      },
      {
        id: "templates-vs-ai",
        title: "القوالب، الذكاء الاصطناعي المجاني، ومفتاحك الخاص (BYOK) — ما الفرق؟",
        body: [
          "كل ميزة في Postify تعمل مجانًا، دون أي إعداد. يتم بناء التسميات التوضيحية والملصقات والفيديوهات من قوالب حقيقية مصممة خصيصًا لمجال عملك وعلامتك التجارية — وليست نصوصًا عشوائية.",
          "\"الذكاء الاصطناعي المجاني\" يذهب خطوة أبعد للنصوص: عند توفره، يستخدم Postify نموذج ذكاء اصطناعي مشترك بلا تكلفة لكتابة تسميات توضيحية ونصوص وأفكار حملات أكثر طبيعية بدلاً من القوالب الثابتة. لا تحتاج إلى حساب أو مفتاح لهذا — يعمل تلقائيًا عند توفر السعة.",
          "أما BYOK (\"أحضر مفتاحك الخاص\") فهو لمن يريد أعلى جودة: الصق مفتاح API الخاص بك من مزود مثل OpenAI أو Anthropic أو Google في الإعدادات، ويستخدم Postify مفتاحك لتلك القدرة (نص، صور، صوت، أو موسيقى) بدلاً من الفئة المجانية. يُخزَّن مفتاحك بأمان ولا يُستخدم إلا في طلبات شركتك أنت — ولا يصل أبدًا إلى المتصفح ولا يُسجَّل في أي سجلات.",
          "إذا واجه أحد المزودين المتصلين مشكلة (مفتاح منتهي الصلاحية، انقطاع مؤقت)، يتراجع Postify تلقائيًا إلى أفضل خيار تالٍ — عادةً الفئة المجانية — بدلاً من فشل عملية الإنشاء بالكامل. سترى ملاحظة في النتيجة توضح أي خيار استُخدم فعليًا.",
        ],
      },
      {
        id: "social-accounts",
        title: "ربط حسابات التواصل الاجتماعي",
        body: [
          "في الإعدادات ← النشر، يمكنك اختيار كيفية نشر المحتوى فعليًا. \"يدوي\" هو الخيار الافتراضي والمتاح دائمًا: تنزّل الصورة أو الفيديو النهائي وتنشره بنفسك كالمعتاد.",
          "بالنسبة لفيسبوك وإنستغرام، يمكن لـ Postify النشر مباشرة نيابة عنك بمجرد ربط حسابك — هذا تكامل حقيقي وفعّال، وليس مجرد عنصر شكلي.",
          "يمكن ربط منصات أخرى (لينكد إن، تيك توك، وغيرها) عبر خدمة تجميع اجتماعي باستخدام بيانات اعتماد API الخاصة بك لتلك الخدمة، إن كانت لديك. Postify واضح وصريح بشأن المنصات الفعّالة فعلاً للنشر المباشر مقابل التي تحتاج هذه الخطوة الإضافية — تحقق من الإعدادات لمعرفة الحالة الحقيقية والحالية لكل منصة.",
        ],
      },
      {
        id: "media-library",
        title: "استخدام مكتبة الوسائط",
        body: [
          "كل صورة وفيديو وشعار ترفعه — بالإضافة إلى كل ما ينشئه Postify لك — يُحفظ في مكتبة وسائطك الخاصة. لا شيء ترفعه مرئي أبدًا للشركات الأخرى التي تستخدم Postify.",
          "يمكنك البحث بلغة طبيعية، مثل \"صور مزرعتنا في يوليو\" أو \"آخر زيارة ميدانية\"، بدلاً من التنقيب في المجلدات.",
          "يفضّل Postify صورك وفيديوهاتك الحقيقية على المُولَّدة كلما أمكن — لن يخترع أبدًا نسخة مزيفة من منتجك أو مبناك أو فريقك الحقيقي عندما تكون هناك صورة حقيقية موجودة بالفعل في مكتبتك. تُستخدم المرئيات المُولَّدة بالذكاء الاصطناعي فقط لسد الفجوات (مشاهد خلفية، لقطات داعمة)، وليس لاستبدال ما هو حقيقي.",
        ],
      },
      {
        id: "creative-dna",
        title: "الحمض الإبداعي (Creative DNA) وتعليم الذكاء الاصطناعي",
        body: [
          "الحمض الإبداعي هو ما يتعلمه Postify بهدوء عن عملك بمرور الوقت — أي المواضيع والقوالب والأساليب التي تميل إلى الاحتفاظ بها ونشرها مقابل حذفها أو تجاهلها. لا تحتاج لفعل أي شيء لعمل هذا؛ يعتمد على استخدامك اليومي المعتاد.",
          "يمكنك رؤية بالضبط ما لاحظه، ولماذا، في الإعدادات. إذا كان هناك خطأ، يمكنك قفل درجة موضوع معين ليتوقف عن التغيير، أو إعادة تعيين كل ما تم تعلمه والبدء من جديد — سجل أداء منشوراتك الحقيقي المنشور لا يتأثر أبدًا بإعادة التعيين.",
          "تعليم الذكاء الاصطناعي يتيح لك الذهاب أبعد وإخبار Postify مباشرة: علّم على ملصق أو فيديو موجود بـ\"المزيد مثل هذا\" أو \"لا تكرر هذا أبدًا\"، أو ارفع مثالًا خارجيًا وأخبرنا بما يمثله. تعليم واحد لن يغيّر شيئًا بمفرده — ينتظر Postify نمطًا حقيقيًا (عدة إشارات متسقة) قبل أن يغيّر ما يقترحه، بنفس الحذر الذي يستخدمه في كل ما يتعلمه.",
        ],
      },
      {
        id: "campaigns",
        title: "الحملات والخطط المتكررة",
        body: [
          "تخطط الحملة عدة أيام من المحتوى دفعة واحدة حول هدف واحد — مثل إطلاق منتج أو تخفيضات موسمية — بحيث يبني كل يوم على سابقه بدلاً من تكرار نفس الفكرة.",
          "الخطة المتكررة هي قاعدة دائمة بدلاً من طلب لمرة واحدة: أخبر Postify بعدد الفيديوهات والمنشورات التي تريدها يوميًا ومتى تُنشر، ويستمر في الإنشاء (والنشر إن اخترت ذلك) تلقائيًا حتى توقفه.",
          "تعمل الخطط المتكررة حاليًا مرة واحدة يوميًا (وليس بشكل مستمر)، لذا تُحترم أوقات النشر المجدولة ضمن هذه الدورة اليومية وليس بدقة الدقيقة — يوضح Postify هذا بصراحة في إعدادات الخطة بدلاً من الوعد بدقة أكبر مما يمكنه تقديمه فعلاً.",
        ],
      },
      {
        id: "troubleshooting",
        title: "استكشاف الأخطاء وإصلاحها",
        body: [
          "\"فشل الإنشاء\" أو خطأ غير مألوف من أحد المزودين: أعد المحاولة — يجرب Postify بالفعل عدة خيارات احتياطية تلقائيًا أولاً، لذا الفشل المتكرر يعني عادةً انقطاعًا مؤقتًا لدى المزود. إذا استمر، تحقق من الإعدادات بحثًا عن بيانات اعتماد منتهية الصلاحية.",
          "منشور مجدول لم يُنشر في وقته: تحقق من صفحة النشر لمعرفة السبب الحقيقي (اتصال حساب اجتماعي منتهي الصلاحية هو السبب الأكثر شيوعًا) وأعد المحاولة مباشرة من هناك.",
          "شيء ما يبدو خاطئًا في العربية (اتجاه النص، التخطيط): يرجى الإبلاغ عنه — من المفترض أن تكون العربية صحيحة تمامًا، وليست مجرد ترجمة، لذا يُعامل هذا كخطأ حقيقي وليس قيدًا معروفًا.",
          "ما زلت عالقًا؟ تحقق أولًا من الإرشادات الظاهرة على الصفحة نفسها (معظم النماذج توضح ما حدث بالخطأ في نفس مكان حدوثه) — تُحل معظم المشكلات هناك مباشرة دون الحاجة لهذه الصفحة.",
        ],
      },
    ],
  },
};
