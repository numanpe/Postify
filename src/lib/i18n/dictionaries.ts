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
    media: string; brandKit: string; settings: string; signOut: string; repurpose: string; menu: string;
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
    template: string;
    templateMinimalName: string; templateMinimalDescription: string;
    templateBoldHeadlineName: string; templateBoldHeadlineDescription: string;
    templatePromotionalBannerName: string; templatePromotionalBannerDescription: string;
    templateSplitProductName: string; templateSplitProductDescription: string;
    templateModernBannerName: string; templateModernBannerDescription: string;
    templateBadgeOfferName: string; templateBadgeOfferDescription: string;
    templateMinimalistFrameName: string; templateMinimalistFrameDescription: string;
  };
  video: {
    title: string; subtitle: (name: string) => string; previousVideos: string; topic: string;
    topicPlaceholder: string; format: string; formatSquare: string; formatStory: string;
    formatLandscape: string; narration: string; narrationHint: string; footage: string;
    footageHint: string; noFootage: string; kindVideo: string; kindPhoto: string;
    generatedSuccess: string; generate: string; generating: string;
    motionTemplate: string; motionTemplateStandard: string; motionTemplateStandardHint: string;
    motionTemplateLowerThird: string; motionTemplateLowerThirdHint: string;
    motionTemplateWaveform: string; motionTemplateWaveformHint: string;
    editVideo: string; editVideoTrimStart: string; editVideoTrimEnd: string;
    editVideoOverlayText: string; editVideoOverlayPlaceholder: string;
    editVideoSave: string; editVideoSaving: string; editVideoSaved: string; editVideoCancel: string;
  };
  campaigns: {
    title: string; subtitle: (name: string) => string; yourCampaigns: string;
    postsCount: (n: number) => string; readyCount: (n: number) => string;
    failedCount: (n: number) => string; objective: string; objectivePlaceholder: string;
    startDate: string; days: string; submit: string; submitPending: string;
    processingHint: (n: number) => string; weekdays: string[];
    assetTypePoster: string; assetTypeVideo: string; captionLabel: string; hashtagsLabel: string;
    noCampaignsHint: string;
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
    title: string; subtitle: (name: string) => string; noMedia: string; noMediaHint: string; uploadHint: string;
    upload: string; uploading: string;
  };
  brandKit: {
    title: string; subtitle: (name: string) => string; logo: string; primary: string;
    secondary: string; accent: string; headingFont: string; bodyFont: string; save: string;
    saving: string;
    importTitle: string; importSubtitle: string; importPlaceholder: string; importButton: string;
    importExtracting: string; importLogoFound: string; importUseLogo: string; importLogoApplied: string;
    importColorsFound: string; importUseAsPrimary: string; importUseAsSecondary: string; importUseAsAccent: string;
    importFontsFound: string; importUseAsHeading: string; importUseAsBody: string;
    importNoLogo: string; importNoColors: string; importNoFonts: string; importReviewHint: string;
    importApplied: string;
  };
  settings: {
    title: string; subtitle: string; provider: string; apiKey: string; saveKey: string;
    saving: string;
    voiceEngineTitle: string; voiceEngineSubtitle: string;
    voiceEngineFree: string; voiceEngineFreeDescription: string;
    voiceEngineByok: string; voiceEngineByokDescription: string;
    voiceEngineSave: string; voiceEngineSaved: string;
    apiKeyGuideTitle: string; apiKeyGuideSubtitle: string;
    openaiGuideTitle: string; openaiGuideSteps: string[]; openaiGuideLinkLabel: string;
    elevenLabsGuideTitle: string; elevenLabsGuideSteps: string[]; elevenLabsGuideLinkLabel: string;
    insightsTitle: string; insightsNoData: string;
    insightsSentence: (topic: string, relativeScore: number) => string;
    insightsConfidence: (tier: string, sampleSize: number) => string;
    confidenceLow: string; confidenceMedium: string; confidenceHigh: string;
  };
  repurpose: {
    title: string; subtitle: string;
    sourcePoster: string; sourceVideo: string; sourceText: string;
    choosePoster: string; chooseVideo: string; describePlaceholder: string;
    formatsLabel: string; formatPoster: string; formatVideo: string; formatCaptions: string;
    generate: string; generating: string;
    resultTitle: string; resultPoster: string; resultVideo: string; resultCaptions: string;
    copyButton: string; copiedToast: string;
  };
  publishing: {
    settingsTitle: string; settingsSubtitle: string;
    modeManualTitle: string; modeManualDescription: string;
    modeAggregatorTitle: string; modeAggregatorRecommended: string; modeAggregatorDescription: string;
    modeDirectApiTitle: string; modeDirectApiDescription: string;
    useThisMethod: string; currentMethod: string;
    apiKeyLabel: string; accountMapLabel: string; accountMapHint: string; accountMapPlaceholder: string;
    saveAndUse: string; saving: string; savedCredential: (provider: string) => string;
    advancedOptions: string; comingSoon: string; goToDirectMeta: string; tiktokNotIntegrated: string;
    downloadButton: string; downloadedToast: string;
    publishViaProvider: (provider: string) => string; publishing: string;
    publishDirect: string; selectAccount: string; noAccountsForDirect: string;
    lastAttemptSucceeded: string; lastAttemptFailed: (message: string) => string;
    staleWarning: (days: number) => string; extendRetention: string; fileCleanedUp: string;
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
      repurpose: "Repurpose",
      menu: "Menu",
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
      backgroundAI: "AI-generated (free — add an OpenAI key in Settings for higher, more consistent quality)",
      photo: "Photo",
      photoHint: '(used only when Background is set to "A photo")',
      generatedSuccess: "Poster generated — see it below.",
      template: "Design template",
      templateMinimalName: "Minimal",
      templateMinimalDescription: "Clean full-bleed photo with understated bottom text.",
      templateBoldHeadlineName: "Bold Headline",
      templateBoldHeadlineDescription: "Large, confident type over a darkened photo.",
      templatePromotionalBannerName: "Promotional Banner",
      templatePromotionalBannerDescription: "Photo up top, solid brand-color banner below.",
      templateSplitProductName: "Split Product View",
      templateSplitProductDescription: "Photo and a solid brand panel with logo, message, and CTA.",
      templateModernBannerName: "Modern Banner",
      templateModernBannerDescription: "Bottom gradient with a brand-color accent bar beside the text — clean and current.",
      templateBadgeOfferName: "Badge & Offer",
      templateBadgeOfferDescription: "A centered accent-color card holds the whole message — built for a sale or offer.",
      templateMinimalistFrameName: "Minimalist Frame",
      templateMinimalistFrameDescription: "Clean bottom text with a thin brand-color border frame and a subtle logo watermark.",
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
      narrationHint: "(add an OpenAI or ElevenLabs key in Settings, or switch to the free voice engine)",
      footage: "Footage",
      footageHint: "(pick up to 5 — used in the order listed below)",
      noFootage:
        "No photos or videos uploaded yet — visit Media Library first, or rely on AI-generated visuals if an OpenAI key is configured.",
      kindVideo: "video",
      kindPhoto: "photo",
      generatedSuccess: "Video generated — see it below.",
      generate: "Generate video",
      generating: "Generating… this can take a minute",
      motionTemplate: "Motion style",
      motionTemplateStandard: "Standard",
      motionTemplateStandardHint: "Scenes, captions, and your logo — no extra motion graphics.",
      motionTemplateLowerThird: "Lower-Third Promo",
      motionTemplateLowerThirdHint: "An animated banner slides in during the opening hook and the call to action.",
      motionTemplateWaveform: "Audio Waveform",
      motionTemplateWaveformHint: "A live waveform band reacts to the narration and music above the captions.",
      editVideo: "Edit Video",
      editVideoTrimStart: "Trim start",
      editVideoTrimEnd: "Trim end",
      editVideoOverlayText: "Overlay text",
      editVideoOverlayPlaceholder: "e.g. Limited time only",
      editVideoSave: "Save edit",
      editVideoSaving: "Saving edit…",
      editVideoSaved: "Saved — the updated video will appear on the card.",
      editVideoCancel: "Cancel",
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
      assetTypePoster: "Poster",
      assetTypeVideo: "Video",
      captionLabel: "Caption",
      hashtagsLabel: "Hashtags",
      noCampaignsHint: "Describe an objective above and we'll plan a coherent week of posts for you — no campaigns yet.",
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
      noMediaHint: "Add your logo, product photos, or site footage — they'll show up here and become real building blocks for your posters and videos.",
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
      importTitle: "Import from a website",
      importSubtitle: "Paste your website URL and we'll pull your logo, colors, and fonts for you to review below — nothing is saved until you click Save Brand Kit.",
      importPlaceholder: "https://yourcompany.com",
      importButton: "Extract",
      importExtracting: "Extracting…",
      importLogoFound: "Logo found",
      importUseLogo: "Use this logo",
      importLogoApplied: "Will be imported as your logo",
      importColorsFound: "Colors found",
      importUseAsPrimary: "Use as Primary",
      importUseAsSecondary: "Use as Secondary",
      importUseAsAccent: "Use as Accent",
      importFontsFound: "Fonts found",
      importUseAsHeading: "Use as Heading",
      importUseAsBody: "Use as Body",
      importNoLogo: "No logo detected on this page.",
      importNoColors: "No brand colors detected on this page.",
      importNoFonts: "No custom fonts detected on this page.",
      importReviewHint: "Review the extracted values below, then click Save Brand Kit to apply them.",
      importApplied: "Applied",
    },
    settings: {
      title: "AI Providers",
      subtitle:
        "Optional — Postify works fully without any key. Add your own OpenAI, Anthropic, or ElevenLabs key for higher-quality generation. Your key is encrypted at rest and never shown again after saving.",
      provider: "Provider",
      apiKey: "API key",
      saveKey: "Save key",
      saving: "Saving…",
      voiceEngineTitle: "Voiceover engine",
      voiceEngineSubtitle: "Choose how spoken narration for your videos gets generated.",
      voiceEngineFree: "Use built-in free model",
      voiceEngineFreeDescription:
        "No key needed. Runs on a free, community-maintained engine — quality is good but it's not an official Microsoft/OpenAI product, so it can occasionally be slower or unavailable.",
      voiceEngineByok: "Use my own API key (OpenAI or ElevenLabs)",
      voiceEngineByokDescription:
        "Higher, studio-grade voice quality. Requires an OpenAI or ElevenLabs key saved below — narration will fail until one is added.",
      voiceEngineSave: "Save",
      voiceEngineSaved: "Saved.",
      apiKeyGuideTitle: "How to get an API key",
      apiKeyGuideSubtitle: "Step-by-step, for anyone who hasn't done this before.",
      openaiGuideTitle: "OpenAI (scripts + AI images + voice)",
      openaiGuideSteps: [
        "Go to platform.openai.com and sign up or log in.",
        "Open Settings → Billing and add a payment method (OpenAI requires this even for small usage).",
        "Go to API keys, click \"Create new secret key\", and give it a name like \"Postify\".",
        "Copy the key immediately — OpenAI only shows it once.",
        "Paste it into the API key field above, choose OpenAI as the provider, and save.",
      ],
      openaiGuideLinkLabel: "Get OpenAI key → platform.openai.com/api-keys",
      elevenLabsGuideTitle: "ElevenLabs (hyper-realistic voiceovers)",
      elevenLabsGuideSteps: [
        "Go to elevenlabs.io and sign up or log in.",
        "Open your Profile (click your name, bottom-left) → API Keys.",
        "Click \"Create API key\", name it \"Postify\", and copy it.",
        "Paste it into the API key field above, choose ElevenLabs as the provider, and save.",
        "In the voiceover engine section above, switch to \"Use my own API key\" so videos actually use it.",
      ],
      elevenLabsGuideLinkLabel: "Get ElevenLabs key → elevenlabs.io",
      insightsTitle: "What's working",
      insightsNoData:
        "Not enough published posts with measured engagement yet — this fills in once you've published several posts through a connected Facebook or Instagram account.",
      insightsSentence: (topic: string, relativeScore: number) =>
        `${topic} posts are getting ${relativeScore}x your average engagement.`,
      insightsConfidence: (tier: string, sampleSize: number) =>
        `Confidence: ${tier} (based on ${sampleSize} published post${sampleSize === 1 ? "" : "s"}).`,
      confidenceLow: "low",
      confidenceMedium: "medium",
      confidenceHigh: "high",
    },
    repurpose: {
      title: "Repurpose This",
      subtitle: "Turn one piece of content into a small package of new formats — reusing your existing pipelines, not a new one.",
      sourcePoster: "An existing poster",
      sourceVideo: "An existing video",
      sourceText: "Describe it myself",
      choosePoster: "Choose a poster",
      chooseVideo: "Choose a video",
      describePlaceholder: "e.g. our new spring menu, 20% off this weekend",
      formatsLabel: "Generate as",
      formatPoster: "Poster",
      formatVideo: "Video (Reel)",
      formatCaptions: "3 caption variants",
      generate: "Generate package",
      generating: "Generating… this can take a minute",
      resultTitle: "Your repurposed package",
      resultPoster: "New poster",
      resultVideo: "New video",
      resultCaptions: "Caption variants",
      copyButton: "Copy",
      copiedToast: "Copied.",
    },
    publishing: {
      settingsTitle: "Publishing",
      settingsSubtitle:
        "Choose how your posters and videos get published from campaign cards. Manual download is always free and always works — the other options are optional.",
      modeManualTitle: "Manual Download & Copy",
      modeManualDescription: "Zero setup, 100% free. Download the file, paste the caption yourself.",
      modeAggregatorTitle: "Zernio / Automated Social Router",
      modeAggregatorRecommended: "(Recommended)",
      modeAggregatorDescription:
        "Paste your own Zernio API key — posts go out through your Zernio account, at Zernio's own pricing. Postify never charges for this.",
      modeDirectApiTitle: "Direct Meta / TikTok API",
      modeDirectApiDescription:
        "Publish straight to a Facebook Page or Instagram account you connect below. TikTok isn't integrated yet.",
      useThisMethod: "Use this method",
      currentMethod: "Currently in use",
      apiKeyLabel: "API key",
      accountMapLabel: "Platform account IDs",
      accountMapHint:
        "From your provider's own dashboard — one per platform you want to publish to. Upload-Post instead uses a single profile name: add _PROFILE_:your_upload_post_username.",
      accountMapPlaceholder: "FACEBOOK:acc_123, INSTAGRAM:acc_456",
      saveAndUse: "Save & use Zernio",
      saving: "Saving…",
      savedCredential: (provider: string) => `${provider} key saved.`,
      advancedOptions: "Advanced options",
      comingSoon: "Coming soon",
      goToDirectMeta: "Connect Facebook / Instagram →",
      tiktokNotIntegrated: "TikTok — no integration exists yet. Not offered as a fake option.",
      downloadButton: "Download & copy caption",
      downloadedToast: "Downloaded — caption and hashtags copied.",
      publishViaProvider: (provider: string) => `Publish via ${provider}`,
      publishing: "Publishing…",
      publishDirect: "Publish directly",
      selectAccount: "Account",
      noAccountsForDirect: "Connect a Facebook/Instagram account in Publish first.",
      lastAttemptSucceeded: "Published successfully.",
      lastAttemptFailed: (message: string) => `Publish failed: ${message}`,
      staleWarning: (days: number) =>
        `Not downloaded or published in over ${days} days — it may be removed soon to save storage.`,
      extendRetention: "Keep for 30 more days",
      fileCleanedUp: "The original file was removed after a confirmed publish — captions and history are still saved.",
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
      repurpose: "إعادة التوظيف",
      menu: "القائمة",
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
      backgroundAI: "من إنشاء الذكاء الاصطناعي (مجاني — أضف مفتاح OpenAI في الإعدادات لجودة أعلى وأكثر ثباتًا)",
      photo: "الصورة",
      photoHint: '(تُستخدم فقط عند اختيار "صورة" كخلفية)',
      generatedSuccess: "تم إنشاء الملصق — شاهده أدناه.",
      template: "قالب التصميم",
      templateMinimalName: "بسيط",
      templateMinimalDescription: "صورة كاملة بخلفية نظيفة ونص سفلي هادئ.",
      templateBoldHeadlineName: "عنوان جريء",
      templateBoldHeadlineDescription: "خط كبير وواثق فوق صورة معتّمة.",
      templatePromotionalBannerName: "لافتة ترويجية",
      templatePromotionalBannerDescription: "صورة في الأعلى، وشريط بلون العلامة أسفلها.",
      templateSplitProductName: "عرض منتج مقسّم",
      templateSplitProductDescription: "صورة ولوحة بلون العلامة تضم الشعار والرسالة والدعوة لاتخاذ إجراء.",
      templateModernBannerName: "لافتة عصرية",
      templateModernBannerDescription: "تدرّج سفلي مع شريط تمييز بلون العلامة بجانب النص — نظيف وعصري.",
      templateBadgeOfferName: "شارة وعرض",
      templateBadgeOfferDescription: "بطاقة مركزية بلون العلامة تحمل الرسالة كاملة — مصمّمة للتخفيضات والعروض.",
      templateMinimalistFrameName: "إطار بسيط",
      templateMinimalistFrameDescription: "نص سفلي نظيف مع إطار رفيع بلون العلامة وعلامة مائية خفيفة للشعار.",
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
      narrationHint: "(أضف مفتاح OpenAI أو ElevenLabs في الإعدادات، أو بدّل إلى محرك الصوت المجاني)",
      footage: "اللقطات",
      footageHint: "(اختر حتى 5 — تُستخدم بالترتيب المدرج أدناه)",
      noFootage:
        "لم يتم رفع صور أو فيديوهات بعد — قم بزيارة مكتبة الوسائط أولًا، أو اعتمد على مرئيات الذكاء الاصطناعي إذا كان مفتاح OpenAI مُفعّلًا.",
      kindVideo: "فيديو",
      kindPhoto: "صورة",
      generatedSuccess: "تم إنشاء الفيديو — شاهده أدناه.",
      generate: "إنشاء الفيديو",
      generating: "جارٍ الإنشاء… قد يستغرق ذلك دقيقة",
      motionTemplate: "أسلوب الحركة",
      motionTemplateStandard: "قياسي",
      motionTemplateStandardHint: "مشاهد وترجمة وشعارك — دون رسوميات حركية إضافية.",
      motionTemplateLowerThird: "شريط ترويجي سفلي",
      motionTemplateLowerThirdHint: "شريط متحرك ينزلق خلال الافتتاحية ودعوة اتخاذ الإجراء.",
      motionTemplateWaveform: "موجة صوتية",
      motionTemplateWaveformHint: "شريط موجة صوتية حي يتفاعل مع التعليق الصوتي والموسيقى فوق الترجمة.",
      editVideo: "تعديل الفيديو",
      editVideoTrimStart: "بداية القص",
      editVideoTrimEnd: "نهاية القص",
      editVideoOverlayText: "نص فوق الفيديو",
      editVideoOverlayPlaceholder: "مثال: لفترة محدودة فقط",
      editVideoSave: "حفظ التعديل",
      editVideoSaving: "جارٍ حفظ التعديل…",
      editVideoSaved: "تم الحفظ — سيظهر الفيديو المُحدَّث على البطاقة.",
      editVideoCancel: "إلغاء",
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
      assetTypePoster: "ملصق",
      assetTypeVideo: "فيديو",
      captionLabel: "التسمية التوضيحية",
      hashtagsLabel: "الوسوم",
      noCampaignsHint: "صف هدفًا أعلاه وسنخطط لك أسبوعًا متكاملًا من المنشورات — لا توجد حملات بعد.",
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
      noMediaHint: "أضف شعارك أو صور منتجاتك أو لقطات موقعك — ستظهر هنا وتصبح لبنات حقيقية لملصقاتك وفيديوهاتك.",
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
      importTitle: "استيراد من موقع إلكتروني",
      importSubtitle: "الصق رابط موقعك وسنستخرج الشعار والألوان والخطوط لمراجعتها أدناه — لن يُحفظ شيء حتى تضغط على حفظ هوية العلامة.",
      importPlaceholder: "https://yourcompany.com",
      importButton: "استخراج",
      importExtracting: "جارٍ الاستخراج…",
      importLogoFound: "تم العثور على شعار",
      importUseLogo: "استخدام هذا الشعار",
      importLogoApplied: "سيتم استيراده كشعارك",
      importColorsFound: "الألوان المكتشفة",
      importUseAsPrimary: "استخدام كلون أساسي",
      importUseAsSecondary: "استخدام كلون ثانوي",
      importUseAsAccent: "استخدام كلون مميز",
      importFontsFound: "الخطوط المكتشفة",
      importUseAsHeading: "استخدام لخط العناوين",
      importUseAsBody: "استخدام لخط النص",
      importNoLogo: "لم يتم العثور على شعار في هذه الصفحة.",
      importNoColors: "لم يتم اكتشاف ألوان للعلامة في هذه الصفحة.",
      importNoFonts: "لم يتم اكتشاف خطوط مخصصة في هذه الصفحة.",
      importReviewHint: "راجع القيم المستخرجة أدناه، ثم اضغط على حفظ هوية العلامة لتطبيقها.",
      importApplied: "تم التطبيق",
    },
    settings: {
      title: "مزوّدو الذكاء الاصطناعي",
      subtitle:
        "اختياري — يعمل بوستيفاي بشكل كامل دون أي مفتاح. أضف مفتاح OpenAI أو Anthropic أو ElevenLabs الخاص بك للحصول على نتائج أعلى جودة. يتم تشفير مفتاحك عند التخزين ولا يُعرض مجددًا بعد الحفظ.",
      provider: "المزوّد",
      apiKey: "مفتاح API",
      saveKey: "حفظ المفتاح",
      saving: "جارٍ الحفظ…",
      voiceEngineTitle: "محرك التعليق الصوتي",
      voiceEngineSubtitle: "اختر الطريقة التي يُنشأ بها التعليق الصوتي لمقاطع الفيديو الخاصة بك.",
      voiceEngineFree: "استخدام النموذج المجاني المدمج",
      voiceEngineFreeDescription:
        "لا حاجة لأي مفتاح. يعمل على محرك مجاني يديره المجتمع — الجودة جيدة، لكنه ليس منتجًا رسميًا من مايكروسوفت أو OpenAI، لذا قد يكون أبطأ أو غير متاح أحيانًا.",
      voiceEngineByok: "استخدام مفتاح API الخاص بي (OpenAI أو ElevenLabs)",
      voiceEngineByokDescription:
        "جودة صوت أعلى بمستوى استوديو احترافي. يتطلب حفظ مفتاح OpenAI أو ElevenLabs أدناه — سيفشل إنشاء التعليق الصوتي حتى تتم إضافة مفتاح.",
      voiceEngineSave: "حفظ",
      voiceEngineSaved: "تم الحفظ.",
      apiKeyGuideTitle: "كيفية الحصول على مفتاح API",
      apiKeyGuideSubtitle: "خطوة بخطوة، لمن لم يفعل هذا من قبل.",
      openaiGuideTitle: "OpenAI (النصوص + الصور بالذكاء الاصطناعي + الصوت)",
      openaiGuideSteps: [
        "اذهب إلى platform.openai.com وأنشئ حسابًا أو سجّل الدخول.",
        "افتح الإعدادات ← الفوترة وأضف وسيلة دفع (يتطلبها OpenAI حتى للاستخدام البسيط).",
        "اذهب إلى API keys، اضغط \"Create new secret key\"، وسمِّه مثلًا \"Postify\".",
        "انسخ المفتاح فورًا — يعرضه OpenAI مرة واحدة فقط.",
        "الصقه في حقل مفتاح API أعلاه، اختر OpenAI كمزوّد، ثم احفظ.",
      ],
      openaiGuideLinkLabel: "احصل على مفتاح OpenAI ← platform.openai.com/api-keys",
      elevenLabsGuideTitle: "ElevenLabs (تعليق صوتي فائق الواقعية)",
      elevenLabsGuideSteps: [
        "اذهب إلى elevenlabs.io وأنشئ حسابًا أو سجّل الدخول.",
        "افتح الملف الشخصي (اضغط اسمك أسفل اليسار) ← API Keys.",
        "اضغط \"Create API key\"، سمِّه \"Postify\"، وانسخه.",
        "الصقه في حقل مفتاح API أعلاه، اختر ElevenLabs كمزوّد، ثم احفظ.",
        "في قسم محرك التعليق الصوتي أعلاه، بدّل إلى \"استخدام مفتاح API الخاص بي\" ليتم استخدامه فعليًا في الفيديوهات.",
      ],
      elevenLabsGuideLinkLabel: "احصل على مفتاح ElevenLabs ← elevenlabs.io",
      insightsTitle: "ما الذي ينجح",
      insightsNoData:
        "لا توجد منشورات كافية منشورة وقيست تفاعلاتها بعد — ستظهر هذه المعلومات بعد نشر عدة منشورات عبر حساب فيسبوك أو إنستغرام متصل.",
      insightsSentence: (topic: string, relativeScore: number) =>
        `منشورات "${topic}" تحقق تفاعلاً يعادل ${relativeScore}× متوسط تفاعلك.`,
      insightsConfidence: (tier: string, sampleSize: number) => `مستوى الثقة: ${tier} (استنادًا إلى ${sampleSize} منشورًا).`,
      confidenceLow: "منخفض",
      confidenceMedium: "متوسط",
      confidenceHigh: "عالٍ",
    },
    repurpose: {
      title: "إعادة توظيف المحتوى",
      subtitle: "حوّل قطعة محتوى واحدة إلى مجموعة صيغ جديدة — باستخدام أنظمتك الحالية، وليس نظامًا جديدًا.",
      sourcePoster: "ملصق موجود",
      sourceVideo: "فيديو موجود",
      sourceText: "وصفه بنفسي",
      choosePoster: "اختر ملصقًا",
      chooseVideo: "اختر فيديو",
      describePlaceholder: "مثال: قائمة طعامنا الجديدة لفصل الربيع، خصم 20% نهاية هذا الأسبوع",
      formatsLabel: "إنشاء كـ",
      formatPoster: "ملصق",
      formatVideo: "فيديو (ريل)",
      formatCaptions: "3 نسخ من التسمية التوضيحية",
      generate: "إنشاء المجموعة",
      generating: "جارٍ الإنشاء… قد يستغرق ذلك دقيقة",
      resultTitle: "مجموعتك المُعاد توظيفها",
      resultPoster: "ملصق جديد",
      resultVideo: "فيديو جديد",
      resultCaptions: "نسخ التسمية التوضيحية",
      copyButton: "نسخ",
      copiedToast: "تم النسخ.",
    },
    publishing: {
      settingsTitle: "النشر",
      settingsSubtitle:
        "اختر طريقة نشر ملصقاتك وفيديوهاتك من بطاقات الحملة. التنزيل اليدوي مجاني دائمًا ويعمل دائمًا — بقية الخيارات اختيارية.",
      modeManualTitle: "التنزيل اليدوي والنسخ",
      modeManualDescription: "بلا إعداد، مجاني 100%. نزّل الملف والصق التسمية التوضيحية بنفسك.",
      modeAggregatorTitle: "Zernio / موجّه النشر الآلي",
      modeAggregatorRecommended: "(موصى به)",
      modeAggregatorDescription:
        "الصق مفتاح Zernio الخاص بك — تُنشر المنشورات عبر حساب Zernio الخاص بك، وفق أسعار Zernio نفسها. بوستيفاي لا يفرض رسومًا على هذا مطلقًا.",
      modeDirectApiTitle: "واجهة Meta / TikTok المباشرة",
      modeDirectApiDescription:
        "انشر مباشرة إلى صفحة فيسبوك أو حساب إنستغرام تربطه أدناه. TikTok غير مدمج بعد.",
      useThisMethod: "استخدام هذه الطريقة",
      currentMethod: "قيد الاستخدام حاليًا",
      apiKeyLabel: "مفتاح API",
      accountMapLabel: "معرّفات حسابات المنصّات",
      accountMapHint:
        "من لوحة تحكم المزوّد — واحد لكل منصّة تريد النشر إليها. أما Upload-Post فيستخدم اسم ملف واحد: أضف _PROFILE_:اسم_مستخدمك_في_Upload-Post.",
      accountMapPlaceholder: "FACEBOOK:acc_123, INSTAGRAM:acc_456",
      saveAndUse: "حفظ واستخدام Zernio",
      saving: "جارٍ الحفظ…",
      savedCredential: (provider: string) => `تم حفظ مفتاح ${provider}.`,
      advancedOptions: "خيارات متقدمة",
      comingSoon: "قريبًا",
      goToDirectMeta: "ربط فيسبوك / إنستغرام ←",
      tiktokNotIntegrated: "TikTok — لا يوجد تكامل بعد. لا يُعرض كخيار وهمي.",
      downloadButton: "تنزيل ونسخ التسمية التوضيحية",
      downloadedToast: "تم التنزيل — تم نسخ التسمية التوضيحية والوسوم.",
      publishViaProvider: (provider: string) => `النشر عبر ${provider}`,
      publishing: "جارٍ النشر…",
      publishDirect: "نشر مباشر",
      selectAccount: "الحساب",
      noAccountsForDirect: "اربط حساب فيسبوك/إنستغرام من صفحة النشر أولًا.",
      lastAttemptSucceeded: "تم النشر بنجاح.",
      lastAttemptFailed: (message: string) => `فشل النشر: ${message}`,
      staleWarning: (days: number) => `لم يُنزَّل أو يُنشر منذ أكثر من ${days} يومًا — قد تتم إزالته قريبًا لتوفير المساحة.`,
      extendRetention: "الاحتفاظ به 30 يومًا إضافية",
      fileCleanedUp: "تمت إزالة الملف الأصلي بعد نشر مؤكد — التسميات التوضيحية والسجل ما زالا محفوظين.",
    },
  },
};

export type Locale = keyof typeof dictionaries;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
