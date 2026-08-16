// Real per-locale strings, not a shared English template with swapped-in
// words — interpolated entries are functions so each locale can use its
// own natural sentence structure (Arabic word order for "N posts, M
// ready" isn't English's), per CLAUDE.md's "natural, non-literal
// translation" requirement. Scope: this covers the app's own UI chrome
// (nav, headings, form labels, buttons, static copy) for every
// authenticated page. It does NOT cover /login and /signup (there's no
// company yet to have a language preference — those stay English until
// a separate pre-auth mechanism is worth building) or dynamic
// server-action validation/error copy (a much larger follow-up: every
// zod schema across every action would need locale-aware messages,
// which needs locale threaded into the action layer itself, not just
// rendering). Both are deliberate, communicated scope boundaries.

// Declared explicitly (not inferred via `as const`) so both locales are
// checked against the exact same shape — a missing key in either
// dictionary is a compile error, not a silent runtime fallback to
// English strings mid-Arabic-page.
export interface Dictionary {
  nav: {
    studio: string; poster: string; video: string; campaigns: string; publish: string;
    media: string; brandKit: string; settings: string; signOut: string;
  };
  common: {
    save: string; cancel: string; remove: string; delete: string; retry: string;
    regenerate: string; approve: string; processNow: string; manage: string; optional: string;
  };
  status: {
    PENDING: string; GENERATING: string; READY: string; FAILED: string; APPROVED: string;
    DRAFT: string; SCHEDULED: string; PUBLISHING: string; PUBLISHED: string;
  };
  onboarding: {
    title: string; subtitle: string; companyName: string; primaryIndustry: string;
    selectIndustry: string; secondaryNiches: string; secondaryNichesHint: string;
    secondaryNichesPlaceholder: string; language: string; languageHint: string;
    submit: string; submitPending: string;
  };
  studio: {
    title: string; subtitle: (name: string) => string; topicPlaceholder: string;
    generate: string; generating: string;
  };
  poster: {
    title: string; subtitle: (name: string) => string; previousPosters: string;
    headline: string; subhead: string; cta: string; ctaPlaceholder: string; format: string;
    formatSquare: string; formatStory: string; formatLandscape: string; background: string;
    backgroundBrand: string; backgroundPhoto: string; backgroundAI: string; photo: string;
    photoHint: string; generatedSuccess: string; generate: string; generating: string;
  };
  video: {
    title: string; subtitle: (name: string) => string; previousVideos: string; topic: string;
    topicPlaceholder: string; format: string; formatSquare: string; formatStory: string;
    formatLandscape: string; narration: string; narrationHint: string; footage: string;
    footageHint: string; noFootage: string; kindVideo: string; kindPhoto: string;
    generatedSuccess: string; generate: string; generating: string;
  };
  campaigns: {
    title: string; subtitle: (name: string) => string; yourCampaigns: string;
    postsCount: (n: number) => string; readyCount: (n: number) => string;
    failedCount: (n: number) => string; objective: string; objectivePlaceholder: string;
    startDate: string; days: string; submit: string; submitPending: string;
    processingHint: (n: number) => string; weekdays: string[];
  };
  publish: {
    title: string; subtitle: string; connectedSuccess: string;
    connectedError: (detail: string) => string; noPostersYetPrefix: string;
    noPostersYetSuffix: string; connectFirst: string; processingHint: (n: number) => string;
    connectedAccounts: string; connectButton: string; noAccounts: string;
    reconnectNeeded: string; disconnect: string; publishTo: string; poster: string;
    caption: string; when: string; whenHint: string; queuePost: string; queuing: string;
    history: string; posterRemoved: string; scheduledFor: string; attempted: string;
    viewPost: string; platformFacebook: string; platformInstagram: string;
  };
  media: {
    title: string; subtitle: (name: string) => string; noMedia: string; uploadHint: string;
    upload: string; uploading: string;
  };
  brandKit: {
    title: string; subtitle: (name: string) => string; logo: string; primary: string;
    secondary: string; accent: string; headingFont: string; bodyFont: string; save: string;
    saving: string;
  };
  settings: {
    title: string; subtitle: string; provider: string; apiKey: string; saveKey: string;
    saving: string;
  };
}

export const dictionaries: Record<"en" | "ar", Dictionary> = {
  en: {
    nav: {
      studio: "Content Studio",
      poster: "Poster Studio",
      video: "Video Studio",
      campaigns: "Campaigns",
      publish: "Publish",
      media: "Media Library",
      brandKit: "Brand Kit",
      settings: "Settings",
      signOut: "Sign out",
    },
    common: {
      save: "Save",
      cancel: "Cancel",
      remove: "Remove",
      delete: "Delete",
      retry: "Retry",
      regenerate: "Regenerate",
      approve: "Approve",
      processNow: "Process now",
      manage: "Manage",
      optional: "(optional)",
    },
    status: {
      PENDING: "Pending",
      GENERATING: "Generating",
      READY: "Ready",
      FAILED: "Failed",
      APPROVED: "Approved",
      DRAFT: "Draft",
      SCHEDULED: "Scheduled",
      PUBLISHING: "Publishing",
      PUBLISHED: "Published",
    },
    onboarding: {
      title: "Set up your company",
      subtitle: "This takes about a minute.",
      companyName: "Company name",
      primaryIndustry: "Primary industry",
      selectIndustry: "Select an industry",
      secondaryNiches: "Secondary niches",
      secondaryNichesHint: "(optional, comma-separated)",
      secondaryNichesPlaceholder: "e.g. Livestock, B2B",
      language: "Language",
      languageHint: "You can change this later.",
      submit: "Create company",
      submitPending: "Creating…",
    },
    studio: {
      title: "Content Studio",
      subtitle: (name: string) =>
        `Generate a social caption for ${name}, tailored to your industry and brand tone.`,
      topicPlaceholder: "What's this post about? e.g. our new spring menu",
      generate: "Generate",
      generating: "Generating…",
    },
    poster: {
      title: "Poster Studio",
      subtitle: (name: string) => `Generate a publish-ready poster for ${name}.`,
      previousPosters: "Previous posters",
      headline: "Headline",
      subhead: "Subhead",
      cta: "Call to action",
      ctaPlaceholder: "e.g. Shop now",
      format: "Format",
      formatSquare: "Square (1:1)",
      formatStory: "Story (9:16)",
      formatLandscape: "Landscape (16:9)",
      background: "Background",
      backgroundBrand: "Brand gradient (free)",
      backgroundPhoto: "A photo from Media Library",
      backgroundAI: "AI-generated (needs an OpenAI key in Settings)",
      photo: "Photo",
      photoHint: '(used only when Background is set to "A photo")',
      generatedSuccess: "Poster generated — see it below.",
      generate: "Generate poster",
      generating: "Generating…",
    },
    video: {
      title: "Video Studio",
      subtitle: (name: string) =>
        `Generate a short video for ${name}: script, real/AI B-roll, captions, music, and your branding.`,
      previousVideos: "Previous videos",
      topic: "What's this video about?",
      topicPlaceholder: "e.g. our new spring menu",
      format: "Format",
      formatSquare: "Square (1:1)",
      formatStory: "Story / Reel (9:16)",
      formatLandscape: "Landscape (16:9)",
      narration: "Add spoken narration",
      narrationHint: "(needs an OpenAI key in Settings)",
      footage: "Footage",
      footageHint: "(pick up to 5 — used in the order listed below)",
      noFootage:
        "No photos or videos uploaded yet — visit Media Library first, or rely on AI-generated visuals if an OpenAI key is configured.",
      kindVideo: "video",
      kindPhoto: "photo",
      generatedSuccess: "Video generated — see it below.",
      generate: "Generate video",
      generating: "Generating… this can take a minute",
    },
    campaigns: {
      title: "Campaigns",
      subtitle: (name: string) => `Plan a run of coherent, connected posts for ${name} across several days.`,
      yourCampaigns: "Your campaigns",
      postsCount: (n: number) => `${n} post${n === 1 ? "" : "s"}`,
      readyCount: (n: number) => `${n} ready`,
      failedCount: (n: number) => `${n} failed`,
      objective: "What's this campaign about?",
      objectivePlaceholder: "e.g. our spring sale",
      startDate: "Start date",
      days: "Days",
      submit: "Create campaign",
      submitPending: "Planning…",
      processingHint: (n: number) =>
        `${n} post${n === 1 ? " is" : "s are"} still generating — this app doesn't have a real scheduler wired up in this environment, so click to process the queue yourself (production would run this automatically; see README).`,
      weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
    publish: {
      title: "Publish",
      subtitle: "Post an existing poster directly to a connected Facebook Page or Instagram account.",
      connectedSuccess: "Connected successfully.",
      connectedError: (detail: string) => `Couldn't connect: ${detail}`,
      noPostersYetPrefix: "No posters yet — generate one in the",
      noPostersYetSuffix: "first.",
      connectFirst: "Connect a Facebook Page or Instagram account above before you can publish.",
      processingHint: (n: number) =>
        `${n} job${n === 1 ? " is" : "s are"} queued — this app doesn't have a real scheduler wired up in this environment, so click to process the queue yourself (production would run this automatically; see README).`,
      connectedAccounts: "Connected accounts",
      connectButton: "Connect Facebook / Instagram",
      noAccounts:
        "No accounts connected yet. Connecting requires a Facebook Page you administer — an Instagram Business account linked to that Page connects automatically.",
      reconnectNeeded: "reconnect needed",
      disconnect: "Disconnect",
      publishTo: "Publish to",
      poster: "Poster",
      caption: "Caption",
      when: "When",
      whenHint: "(leave blank to publish now)",
      queuePost: "Queue post",
      queuing: "Queuing…",
      history: "Publish history",
      posterRemoved: "(poster removed)",
      scheduledFor: "Scheduled for",
      attempted: "Attempted",
      viewPost: "View post",
      platformFacebook: "Facebook Page",
      platformInstagram: "Instagram",
    },
    media: {
      title: "Media Library",
      subtitle: (name: string) =>
        `Photos, video, audio, and brand assets for ${name}. Tags shown here are structural only — semantic search arrives once AI tagging is built.`,
      noMedia: "No media uploaded yet.",
      uploadHint: "Photos, videos, or audio — up to 25MB each.",
      upload: "Upload",
      uploading: "Uploading…",
    },
    brandKit: {
      title: "Brand Kit",
      subtitle: (name: string) => `Logo, colors, and fonts for ${name}.`,
      logo: "Logo",
      primary: "Primary",
      secondary: "Secondary",
      accent: "Accent",
      headingFont: "Heading font",
      bodyFont: "Body font",
      save: "Save Brand Kit",
      saving: "Saving…",
    },
    settings: {
      title: "AI Providers",
      subtitle:
        "Optional — Postify works fully without any key. Add your own OpenAI or Anthropic key for higher-quality generation. Your key is encrypted at rest and never shown again after saving.",
      provider: "Provider",
      apiKey: "API key",
      saveKey: "Save key",
      saving: "Saving…",
    },
  },
  ar: {
    nav: {
      studio: "استوديو المحتوى",
      poster: "استوديو الملصقات",
      video: "استوديو الفيديو",
      campaigns: "الحملات",
      publish: "النشر",
      media: "مكتبة الوسائط",
      brandKit: "هوية العلامة",
      settings: "الإعدادات",
      signOut: "تسجيل الخروج",
    },
    common: {
      save: "حفظ",
      cancel: "إلغاء",
      remove: "إزالة",
      delete: "حذف",
      retry: "إعادة المحاولة",
      regenerate: "إعادة الإنشاء",
      approve: "اعتماد",
      processNow: "معالجة الآن",
      manage: "إدارة",
      optional: "(اختياري)",
    },
    status: {
      PENDING: "قيد الانتظار",
      GENERATING: "قيد الإنشاء",
      READY: "جاهز",
      FAILED: "فشل",
      APPROVED: "معتمد",
      DRAFT: "مسودة",
      SCHEDULED: "مجدول",
      PUBLISHING: "جارٍ النشر",
      PUBLISHED: "تم النشر",
    },
    onboarding: {
      title: "أنشئ ملف شركتك",
      subtitle: "لن يستغرق الأمر أكثر من دقيقة.",
      companyName: "اسم الشركة",
      primaryIndustry: "المجال الرئيسي",
      selectIndustry: "اختر مجالًا",
      secondaryNiches: "مجالات فرعية",
      secondaryNichesHint: "(اختياري، مفصولة بفواصل)",
      secondaryNichesPlaceholder: "مثال: الثروة الحيوانية، الأعمال بين الشركات",
      language: "اللغة",
      languageHint: "يمكنك تغيير هذا لاحقًا.",
      submit: "إنشاء الشركة",
      submitPending: "جارٍ الإنشاء…",
    },
    studio: {
      title: "استوديو المحتوى",
      subtitle: (name: string) => `أنشئ منشورًا لوسائل التواصل الاجتماعي لـ${name}، بأسلوب يلائم مجالك وهوية علامتك.`,
      topicPlaceholder: "عن ماذا هذا المنشور؟ مثال: قائمة طعامنا الجديدة لفصل الربيع",
      generate: "إنشاء",
      generating: "جارٍ الإنشاء…",
    },
    poster: {
      title: "استوديو الملصقات",
      subtitle: (name: string) => `أنشئ ملصقًا جاهزًا للنشر لـ${name}.`,
      previousPosters: "الملصقات السابقة",
      headline: "العنوان الرئيسي",
      subhead: "العنوان الفرعي",
      cta: "دعوة لاتخاذ إجراء",
      ctaPlaceholder: "مثال: تسوّق الآن",
      format: "الصيغة",
      formatSquare: "مربع (1:1)",
      formatStory: "ستوري (9:16)",
      formatLandscape: "أفقي (16:9)",
      background: "الخلفية",
      backgroundBrand: "تدرّج العلامة (مجاني)",
      backgroundPhoto: "صورة من مكتبة الوسائط",
      backgroundAI: "من إنشاء الذكاء الاصطناعي (يتطلب مفتاح OpenAI في الإعدادات)",
      photo: "الصورة",
      photoHint: '(تُستخدم فقط عند اختيار "صورة" كخلفية)',
      generatedSuccess: "تم إنشاء الملصق — شاهده أدناه.",
      generate: "إنشاء الملصق",
      generating: "جارٍ الإنشاء…",
    },
    video: {
      title: "استوديو الفيديو",
      subtitle: (name: string) =>
        `أنشئ فيديو قصيرًا لـ${name}: نص، لقطات حقيقية أو من الذكاء الاصطناعي، ترجمة نصية، موسيقى، وهوية علامتك.`,
      previousVideos: "الفيديوهات السابقة",
      topic: "عن ماذا هذا الفيديو؟",
      topicPlaceholder: "مثال: قائمة طعامنا الجديدة لفصل الربيع",
      format: "الصيغة",
      formatSquare: "مربع (1:1)",
      formatStory: "ستوري / ريل (9:16)",
      formatLandscape: "أفقي (16:9)",
      narration: "أضف تعليقًا صوتيًا",
      narrationHint: "(يتطلب مفتاح OpenAI في الإعدادات)",
      footage: "اللقطات",
      footageHint: "(اختر حتى 5 — تُستخدم بالترتيب المدرج أدناه)",
      noFootage:
        "لم يتم رفع صور أو فيديوهات بعد — قم بزيارة مكتبة الوسائط أولًا، أو اعتمد على مرئيات الذكاء الاصطناعي إذا كان مفتاح OpenAI مُفعّلًا.",
      kindVideo: "فيديو",
      kindPhoto: "صورة",
      generatedSuccess: "تم إنشاء الفيديو — شاهده أدناه.",
      generate: "إنشاء الفيديو",
      generating: "جارٍ الإنشاء… قد يستغرق ذلك دقيقة",
    },
    campaigns: {
      title: "الحملات",
      subtitle: (name: string) => `خطّط لسلسلة منشورات مترابطة لـ${name} على مدى عدة أيام.`,
      yourCampaigns: "حملاتك",
      postsCount: (n: number) => `${n} منشورًا`,
      readyCount: (n: number) => `${n} جاهز`,
      failedCount: (n: number) => `${n} فشل`,
      objective: "عن ماذا هذه الحملة؟",
      objectivePlaceholder: "مثال: تخفيضات الربيع",
      startDate: "تاريخ البدء",
      days: "عدد الأيام",
      submit: "إنشاء الحملة",
      submitPending: "جارٍ التخطيط…",
      processingHint: (n: number) =>
        `لا يزال ${n} ${n === 1 ? "منشور قيد" : "منشورات قيد"} الإنشاء — لا يوجد مجدول تلقائي حقيقي في هذه البيئة، لذا اضغط للمعالجة يدويًا (في الإنتاج ستتم هذه العملية تلقائيًا).`,
      weekdays: ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"],
    },
    publish: {
      title: "النشر",
      subtitle: "انشر ملصقًا جاهزًا مباشرة إلى صفحة فيسبوك أو حساب إنستغرام متصل.",
      connectedSuccess: "تم الربط بنجاح.",
      connectedError: (detail: string) => `تعذّر الربط: ${detail}`,
      noPostersYetPrefix: "لا توجد ملصقات بعد — أنشئ واحدًا في",
      noPostersYetSuffix: "أولًا.",
      connectFirst: "اربط صفحة فيسبوك أو حساب إنستغرام أعلاه قبل أن تتمكن من النشر.",
      processingHint: (n: number) =>
        `${n} ${n === 1 ? "مهمة" : "مهام"} قيد الانتظار — لا يوجد مجدول تلقائي حقيقي في هذه البيئة، لذا اضغط للمعالجة يدويًا (في الإنتاج ستتم هذه العملية تلقائيًا).`,
      connectedAccounts: "الحسابات المتصلة",
      connectButton: "ربط فيسبوك / إنستغرام",
      noAccounts:
        "لا توجد حسابات متصلة بعد. يتطلب الربط صفحة فيسبوك تديرها أنت — سيتم ربط حساب إنستغرام للأعمال المرتبط بها تلقائيًا.",
      reconnectNeeded: "يلزم إعادة الربط",
      disconnect: "قطع الاتصال",
      publishTo: "النشر إلى",
      poster: "الملصق",
      caption: "التسمية التوضيحية",
      when: "الموعد",
      whenHint: "(اتركه فارغًا للنشر الآن)",
      queuePost: "جدولة المنشور",
      queuing: "جارٍ الجدولة…",
      history: "سجل النشر",
      posterRemoved: "(تم حذف الملصق)",
      scheduledFor: "مجدول لـ",
      attempted: "تمت المحاولة في",
      viewPost: "عرض المنشور",
      platformFacebook: "صفحة فيسبوك",
      platformInstagram: "إنستغرام",
    },
    media: {
      title: "مكتبة الوسائط",
      subtitle: (name: string) =>
        `الصور والفيديو والصوت وأصول العلامة لـ${name}. الوسوم المعروضة هنا هيكلية فقط — سيتوفر البحث الدلالي عند تفعيل وسم الذكاء الاصطناعي.`,
      noMedia: "لم يتم رفع أي وسائط بعد.",
      uploadHint: "صور أو فيديوهات أو ملفات صوتية — بحد أقصى 25 ميغابايت لكل ملف.",
      upload: "رفع",
      uploading: "جارٍ الرفع…",
    },
    brandKit: {
      title: "هوية العلامة",
      subtitle: (name: string) => `الشعار والألوان والخطوط لـ${name}.`,
      logo: "الشعار",
      primary: "أساسي",
      secondary: "ثانوي",
      accent: "مميز",
      headingFont: "خط العناوين",
      bodyFont: "خط النص",
      save: "حفظ هوية العلامة",
      saving: "جارٍ الحفظ…",
    },
    settings: {
      title: "مزوّدو الذكاء الاصطناعي",
      subtitle:
        "اختياري — يعمل بوستيفاي بشكل كامل دون أي مفتاح. أضف مفتاح OpenAI أو Anthropic الخاص بك للحصول على نتائج أعلى جودة. يتم تشفير مفتاحك عند التخزين ولا يُعرض مجددًا بعد الحفظ.",
      provider: "المزوّد",
      apiKey: "مفتاح API",
      saveKey: "حفظ المفتاح",
      saving: "جارٍ الحفظ…",
    },
  },
};

export type Locale = keyof typeof dictionaries;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
