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
    createContent: string; help: string;
  };
  common: {
    save: string; cancel: string; remove: string; delete: string; retry: string;
    regenerate: string; approve: string; processNow: string; manage: string; optional: string;
    skipToContent: string;
    // Shared across every generation surface (captions/poster/video) —
    // real disclosure when the runtime-failure fallback chain actually
    // kicked in, never shown for a first-choice provider succeeding
    // normally. See fallback-log.ts's FallbackInfo.
    fallbackNotice: (currentProvider: string, originalProvider: string) => string;
    // Video-specific: script/narration/each B-roll still can each fall
    // back independently, so there's no single clean "current provider"
    // the way captions/poster have — this states what failed without
    // guessing a specific replacement for the whole video.
    fallbackNoticeGeneric: (originalProvider: string) => string;
  };
  company: {
    switcherLabel: string; addAnother: string; switchError: string;
  };
  errorBoundary: {
    title: string;
    message: string;
    tryAgain: string;
    goToStudio: string;
  };
  voiceInput: {
    startLabel: string; listeningLabel: string;
    errorNotAllowed: string; errorNoSpeech: string; errorNetwork: string; errorGeneric: string;
  };
  topicGuard: {
    suggestionsLabel: string;
    blockedGeneric: string;
    blockedNoClarify: string;
    clarifiedNotice: (used: string) => string;
  };
  status: {
    PENDING: string; GENERATING: string; READY: string; FAILED: string; APPROVED: string;
    DRAFT: string; SCHEDULED: string; PUBLISHING: string; PUBLISHED: string;
  };
  onboarding: {
    title: string; subtitle: string; companyName: string; primaryIndustry: string;
    selectIndustry: string; secondaryNiches: string; secondaryNichesHint: string;
    secondaryNichesPlaceholder: string; language: string; languageHint: string;
    targetMarket: string; targetMarketHint: string; targetMarketPlaceholder: string;
    submit: string; submitPending: string;
    websiteFirstTitle: string; websiteFirstSubtitle: string; websiteUrlPlaceholder: string;
    extractButton: string; extracting: string; skipManual: string; backToWebsite: string;
    reviewTitle: string; reviewSubtitle: string; reviewLogo: string; reviewNoLogo: string;
    reviewColors: string; reviewNoColors: string; reviewFonts: string; reviewNoFonts: string;
    reviewDescription: string; reviewTone: string; industrySuggestedHint: string;
    createAndContinue: string; creating: string;
    geminiStepTitle: string; geminiStepBody: string; geminiStepDisclosure: string;
    geminiStepGetKeyLink: string; geminiStepApiKeyPlaceholder: string;
    geminiStepConnect: string; geminiStepConnecting: string; geminiStepSkip: string;
    geminiStepConnected: string;
  };
  studio: {
    title: string; subtitle: (name: string) => string; topicPlaceholder: string;
    generate: string; generating: string;
    geminiNudgeText: string; geminiNudgeDismiss: string;
    sharedAiExhaustedText: string;
  };
  wizard: {
    stepOf: (step: number) => string;
    step1Title: string; step1Subtitle: (name: string) => string;
    topicLabel: string; topicPlaceholder: string; autoGenerate: string; autoGenerateHint: string; showAnotherIdea: string;
    generate: string; generating: string;
    chooseHint: string; hashtagsLabel: string; nextCreateAsset: string;
    step2Title: string; toggleStaticPoster: string; toggleMotionVideo: string; nextPreviewPublish: string;
    step3Title: string; step3Subtitle: string;
    autoScheduledLabel: string; autoScheduledLearned: (n: number) => string; autoScheduledDefault: string;
    publishNow: string; scheduleCampaign: string; backToEdit: string;
    startOver: string;
    videoPublishUnavailable: string; downloadVideo: string;
    durationSuggestion: (days: number) => string;
    durationSuggestionCapped: (requestedDays: number, cappedDays: number) => string;
    durationSuggestionAction: string; durationSuggestionDismiss: string;
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
    regenerateBackground: string; regeneratingBackground: string; regenerateBackgroundSuccess: string;
  };
  video: {
    title: string; subtitle: (name: string) => string; previousVideos: string; topic: string;
    topicPlaceholder: string; format: string; formatSquare: string; formatStory: string;
    formatLandscape: string; narration: string; narrationHint: string; footage: string;
    footageHint: string; noFootage: string; kindVideo: string; kindPhoto: string;
    generatedSuccess: string; generate: string; generating: string;
    generatingSlowNotice: string; generatingVerySlowWarning: string; generatingSilentFailure: string;
    motionTemplate: string; motionTemplateStandard: string; motionTemplateStandardHint: string;
    motionTemplateLowerThird: string; motionTemplateLowerThirdHint: string;
    motionTemplateWaveform: string; motionTemplateWaveformHint: string;
    editVideo: string; editVideoLoading: string; editVideoTrimStart: string; editVideoTrimEnd: string;
    editVideoOverlayText: string; editVideoOverlayPlaceholder: string;
    editVideoSave: string; editVideoSaving: string; editVideoSaved: string; editVideoCancel: string;
    editReRendersWholeVideo: string; editSuccessPreview: string;
    scriptEditorTitle: string; scriptEditorHint: string;
    scriptEditorHook: string; scriptEditorContext: string; scriptEditorValue: string;
    scriptEditorMessage: string; scriptEditorCta: string;
    scriptEditorRemoveSection: string; scriptEditorRemoveLastWarning: string;
    scriptEditorSave: string; scriptEditorSaving: string; scriptEditorSaved: string;
    sceneEditorTitle: string;
    sceneMediaSwap: string; sceneMediaSwapPickTitle: string; sceneMediaSwapChooseAsset: string;
    sceneMediaSwapGenerateAi: string; sceneMediaSwapSave: string; sceneMediaSwapSaving: string;
    sceneMediaSwapCancel: string; sceneMediaSwapSaved: string;
    sceneMediaUploadLabel: string; sceneMediaUploading: string; sceneMediaUploadError: string;
    sceneReorderDisabledNarrated: string; sceneDurationDisabledNarrated: string;
    sceneRemoveGuidanceNarrated: string;
    sceneMoveUp: string; sceneMoveDown: string; sceneDurationLabel: string; sceneOverlayTextLabel: string;
    sceneRemoveButton: string; sceneAddButton: string; sceneEditorSave: string; sceneEditorSaving: string;
    sceneEditorSaved: string; sceneCurrentMedia: string;
    sceneNoPreview: string; sceneThumbnailAlt: (n: number) => string; sceneRemoveAria: (n: number) => string;
    sceneDragHandleAria: (n: number) => string; sceneAddAria: string;
    sceneJumpToScript: string; sceneJumpToScriptAria: (section: string) => string;
    sceneMediaSwapUnavailableLegacy: string;
  };
  campaigns: {
    title: string; subtitle: (name: string) => string; yourCampaigns: string;
    postsCount: (n: number) => string; readyCount: (n: number) => string;
    failedCount: (n: number) => string; objective: string; objectivePlaceholder: string;
    startDate: string; days: string; submit: string; submitPending: string;
    processingHint: (n: number) => string; weekdays: string[];
    assetTypePoster: string; assetTypeVideo: string; captionLabel: string; hashtagsLabel: string;
    noCampaignsHint: string;
    durationDetected: (days: number) => string;
    durationDetectedCapped: (requestedDays: number, cappedDays: number) => string;
    durationApply: string;
    previewSingle: string; previewMulti: (days: number) => string;
    useAiBackgrounds: string; useAiBackgroundsDisclosure: string;
    angleLabel: string;
  };
  recurringPlan: {
    title: string; subtitle: string; entryLinkLabel: string;
    postsPerDay: string; videosPerDay: string;
    publishTimes: string; publishTimesHint: string; publishTimesPlaceholder: string;
    targetPlatformsLabel: string;
    objectiveHint: string; objectiveHintPlaceholder: string;
    autoPublish: string; autoPublishWarning: string; autoPublishDisabledHint: string;
    save: string; saving: string; saved: string;
    pause: string; resume: string;
    deleteButton: string; deleteConfirm: string; deleted: string;
    activeBanner: string; pausedBanner: string; cronPrecisionNote: string;
    activityTitle: string; noActivityYet: string;
    errorLabel: (message: string) => string;
    autoPublishItemLabel: (time: string) => string;
  };
  publish: {
    title: string; subtitle: string; connectedSuccess: string;
    connectedError: (detail: string) => string; noPostersYetPrefix: string;
    noPostersYetSuffix: string; connectFirst: string; processingHint: (n: number) => string;
    connectedAccounts: string; connectButton: string; noAccounts: string;
    reconnectNeeded: string; disconnect: string; publishTo: string; poster: string;
    caption: string; when: string; whenHint: string; queuePost: string; queuing: string;
    autoSchedule: string; autoScheduling: string;
    autoScheduleAppliedDefault: string; autoScheduleAppliedLearned: (sampleSize: number) => string;
    history: string; posterRemoved: string; scheduledFor: string; attempted: string;
    viewPost: string; platformFacebook: string; platformInstagram: string;
    platformLinkedIn: string; platformTikTok: string; video: string; noVideosYet: string;
    connectLinkedIn: string; connectTikTok: string; pendingAppReview: string;
  };
  media: {
    title: string; subtitle: (name: string) => string; noMedia: string; noMediaHint: string; uploadHint: string;
    upload: string; uploading: string; noLongerAvailable: string;
    activityTitle: string; activityPublished: (label: string) => string;
    activityPublishFailed: (label: string) => string; activityGenerationFailed: (label: string) => string;
    uploadFilesLabel: string;
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
    importContextFound: string; importNoContext: string; importDescriptionFound: string;
    importToneFound: string; importProductsFound: string; importNoProducts: string; importApplyContext: string;
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
    fishAudioGuideTitle: string; fishAudioGuideSteps: string[]; fishAudioGuideLinkLabel: string;
    fishAudioCostNote: string;
    geminiGuideTitle: string; geminiGuideSteps: string[]; geminiGuideLinkLabel: string;
    geminiCostNote: string; geminiTextFreeNote: string;
    musicCreditsTitle: string; musicCreditsSubtitle: string; musicCreditsLicenseNote: string;
    musicCreditsLicenseLinkLabel: string;
    insightsTitle: string; insightsNoData: string;
    insightsSentence: (topic: string, relativeScore: number) => string;
    insightsConfidence: (tier: string, sampleSize: number) => string;
    confidenceLow: string; confidenceMedium: string; confidenceHigh: string;
    preferencesTitle: string; preferencesSubtitle: string; preferencesNoData: string;
    preferencesPositive: (dimensionLabel: string, value: string) => string;
    preferencesNegative: (dimensionLabel: string, value: string) => string;
    dimensionTopic: string; dimensionTemplate: string; dimensionTone: string; dimensionVisualStyle: string;
    lockButton: string; unlockButton: string; lockedBadge: string;
    resetButton: string; resetConfirm: string; resetDone: string; resetHint: string;
    teachTitle: string; teachSubtitle: string; teachNoContent: string;
    teachMoreLikeThis: string; teachNeverLikeThis: string; teachMarked: string;
    teachExampleTitle: string; teachExampleSubtitle: string; teachExampleFileLabel: string;
    teachExampleTopicPlaceholder: string; teachExampleStylePlaceholder: string;
    teachExampleSubmit: string; teachExampleSubmitting: string; teachExampleDone: string;
    dangerZoneTitle: string; dangerZoneSubtitle: string;
    deleteCompanyButton: string;
    deleteCompanyConfirmTitle: string;
    deleteCompanyConfirmBody: (companyName: string) => string;
    deleteCompanyConfirmLabel: (companyName: string) => string;
    deleteCompanyConfirmPlaceholder: string;
    deleteCompanySubmit: string; deleteCompanyDeleting: string; deleteCompanyCancel: string;
    deleteCompanyMismatch: string;
    deleteCompanyNotOwner: string;
    scopeSectionLabel: string;
    scopeSharedOption: string; scopeSharedOptionHint: string;
    scopeCompanyOnlyOption: string; scopeCompanyOnlyOptionHint: string;
    scopeSharedBadge: string;
    scopeCompanyOnlyBadge: (companyName: string) => string;
    shareCredentialButton: string;
    shareCredentialConfirmTitle: string;
    shareCredentialConfirmBody: (provider: string) => string;
    shareCredentialConfirmSubmit: string;
    shareCredentialCancel: string;
    stopSharingButton: string;
    stopSharingConfirmTitle: string;
    stopSharingImpactBody: (companyNames: string) => string;
    stopSharingNoImpactBody: string;
    stopSharingConfirmSubmit: string;
    stopSharingCancel: string;
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
  socialPreview: {
    trigger: string; title: string; close: string; disclaimer: string;
    tabInstagram: string; tabFacebook: string; tabLinkedin: string; tabTiktok: string;
    cropWarning: string; captionPlaceholder: string; justNow: string; originalAudio: string;
    companyPage: string;
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
      createContent: "Create Content",
      help: "Help",
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
      skipToContent: "Skip to content",
      fallbackNotice: (currentProvider: string, originalProvider: string) =>
        `Generated using ${currentProvider} — your ${originalProvider} had an issue this time.`,
      fallbackNoticeGeneric: (originalProvider: string) =>
        `Your ${originalProvider} had an issue during this generation — a free fallback was used for that part automatically.`,
    },
    company: {
      switcherLabel: "Switch company",
      addAnother: "Add another company",
      switchError: "Couldn't switch companies — please try again.",
    },
    errorBoundary: {
      title: "Something went wrong",
      message:
        "This page hit a real error and couldn't finish — this can happen when a request (like a narrated video render) takes too long or the connection drops partway through. Your other work is safe.",
      tryAgain: "Try again",
      goToStudio: "Go to Content Studio",
    },
    voiceInput: {
      startLabel: "Speak instead of typing",
      listeningLabel: "Listening… tap to stop",
      errorNotAllowed: "Microphone access was blocked — allow it in your browser settings to use voice input.",
      errorNoSpeech: "Didn't catch that — try again.",
      errorNetwork: "Voice input needs an internet connection right now.",
      errorGeneric: "Voice input didn't work — try again, or type instead.",
    },
    topicGuard: {
      suggestionsLabel: "Suggestions",
      blockedGeneric: "That doesn't look like a topic — try something like \"New product announcement\", or pick a suggestion below.",
      blockedNoClarify: "That doesn't look like a topic, and we couldn't confidently figure out what you meant — try something like \"New product announcement\", or pick a suggestion below.",
      clarifiedNotice: (used: string) => `We used "${used}" as the topic instead of what was typed.`,
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
      targetMarket: "Target market",
      targetMarketHint: "(optional)",
      targetMarketPlaceholder: "e.g. Abu Dhabi & Al Ain, or Nationwide B2B",
      language: "Language",
      languageHint: "You can change this later.",
      submit: "Create company",
      submitPending: "Creating…",
      websiteFirstTitle: "Have a website?",
      websiteFirstSubtitle: "Paste the URL and we'll set most of this up for you.",
      websiteUrlPlaceholder: "yourcompany.com",
      extractButton: "Extract",
      extracting: "Analyzing your site…",
      skipManual: "I'll set this up manually",
      backToWebsite: "Have a website instead?",
      reviewTitle: "Here's what we found",
      reviewSubtitle: "Review and edit anything below, then continue.",
      reviewLogo: "Logo",
      reviewNoLogo: "We couldn't find a logo — you can add one later from Brand Kit settings.",
      reviewColors: "Brand colors",
      reviewNoColors: "We couldn't find explicit brand colors on this page — you can set them later.",
      reviewFonts: "Fonts",
      reviewNoFonts: "We couldn't find explicit font names on this page — you can set them later.",
      reviewDescription: "Business description",
      reviewTone: "Tone of voice",
      industrySuggestedHint: "(suggested from your website — change if needed)",
      createAndContinue: "Create company",
      creating: "Creating…",
      geminiStepTitle: "Want better, more natural AI writing?",
      geminiStepBody:
        "Our quick templates work great and always will. Connecting a free Google Gemini account gets you more natural, varied captions and scripts instead — about 2 minutes, no credit card, no cost.",
      geminiStepDisclosure:
        "One real tradeoff, worth knowing: on Google's free tier, human reviewers may read and use what you submit to improve their AI models (Google disconnects it from your account first). Skip this if you'd rather not share business content that way — templates keep working fully either way.",
      geminiStepGetKeyLink: "Get a free key → aistudio.google.com",
      geminiStepApiKeyPlaceholder: "Paste your Gemini API key",
      geminiStepConnect: "Connect Gemini",
      geminiStepConnecting: "Connecting…",
      geminiStepSkip: "Skip for now",
      geminiStepConnected: "Connected — you'll get Gemini's writing from now on.",
    },
    studio: {
      title: "Content Studio",
      subtitle: (name: string) =>
        `Generate a social caption for ${name}, tailored to your industry and brand tone.`,
      topicPlaceholder: "What's this post about? e.g. our new spring menu",
      generate: "Generate",
      generating: "Generating…",
      geminiNudgeText: "Get better writing for free — connect Gemini in 2 minutes.",
      geminiNudgeDismiss: "Dismiss",
      sharedAiExhaustedText:
        "Today's free AI quota is used up — templates still work, or connect your own free Gemini key in Settings for unlimited access.",
    },
    wizard: {
      stepOf: (step: number) => `Step ${step} of 3`,
      step1Title: "What are we posting about?",
      step1Subtitle: (name: string) => `Start with a topic for ${name} — or let us suggest one.`,
      topicLabel: "Topic",
      topicPlaceholder: "What's this post about? e.g. our new spring menu",
      autoGenerate: "Auto-Generate Daily Idea",
      autoGenerateHint: "Today's suggested idea — the same one all day by design. Want a different one right now?",
      showAnotherIdea: "Show me another idea",
      generate: "Generate",
      generating: "Generating…",
      chooseHint: "Pick the caption you like best — you can still edit it in the next step.",
      hashtagsLabel: "Suggested hashtags",
      nextCreateAsset: "Next: Create Asset",
      step2Title: "Turn it into a poster or video",
      toggleStaticPoster: "Static Poster",
      toggleMotionVideo: "Motion Video",
      nextPreviewPublish: "Next: Preview & Publish",
      step3Title: "Preview & publish",
      step3Subtitle: "See how this looks across platforms, then publish or schedule it.",
      autoScheduledLabel: "Suggested time",
      autoScheduledLearned: (n: number) => `Your own real peak engagement hour, based on ${n} measured posts.`,
      autoScheduledDefault: "A typical GCC peak-engagement hour — not enough measured posts yet for a personalized time.",
      publishNow: "Publish Now",
      scheduleCampaign: "Schedule Campaign",
      backToEdit: "Back to edit",
      startOver: "Start over",
      videoPublishUnavailable:
        "Direct video publishing needs a connected TikTok account — Facebook, Instagram, and LinkedIn don't support video here yet. Connect TikTok on the Publish page, or download the video below.",
      downloadVideo: "Download video",
      durationSuggestion: (days: number) => `This sounds like about ${days} day${days === 1 ? "" : "s"} of content, not just one post.`,
      durationSuggestionCapped: (requestedDays: number, cappedDays: number) =>
        `That sounds like about ${requestedDays} days — this app plans up to ${cappedDays} days at a time, so it'll start with those.`,
      durationSuggestionAction: "Create a full campaign instead",
      durationSuggestionDismiss: "No, just this one post",
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
      regenerateBackground: "Regenerate background",
      regeneratingBackground: "Regenerating…",
      regenerateBackgroundSuccess: "New background generated — see it above.",
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
        "No photos or videos uploaded yet — visit Media Library first, or rely on free AI-generated visuals (add an OpenAI/Gemini key in Settings for higher, more consistent quality).",
      kindVideo: "video",
      kindPhoto: "photo",
      generatedSuccess: "Video generated — see it below.",
      generate: "Generate video",
      generating: "Generating… this can take a minute",
      generatingSlowNotice: "Still working — narrated videos with real voiceover and captions take longer than static ones.",
      generatingVerySlowWarning:
        "This is taking longer than expected. If it doesn't finish soon, try a shorter script, fewer scenes, or turning off narration and trying again.",
      generatingSilentFailure:
        "Something went wrong and the video didn't finish generating — this can happen when a render takes too long. Try a shorter script, fewer scenes, or turning off narration, then generate again.",
      motionTemplate: "Motion style",
      motionTemplateStandard: "Standard",
      motionTemplateStandardHint: "Scenes, captions, and your logo — no extra motion graphics.",
      motionTemplateLowerThird: "Lower-Third Promo",
      motionTemplateLowerThirdHint: "An animated banner slides in during the opening hook and the call to action.",
      motionTemplateWaveform: "Audio Waveform",
      motionTemplateWaveformHint: "A live waveform band reacts to the narration and music above the captions.",
      editVideo: "Edit Video",
      editVideoLoading: "Loading video…",
      editVideoTrimStart: "Trim start",
      editVideoTrimEnd: "Trim end",
      editVideoOverlayText: "Overlay text",
      editVideoOverlayPlaceholder: "e.g. Limited time only",
      editVideoSave: "Save edit",
      editVideoSaving: "Saving edit…",
      editVideoSaved: "Saved — the updated video will appear on the card.",
      editVideoCancel: "Cancel",
      editReRendersWholeVideo: "Saving re-renders the whole video with new narration and captions — this can take a minute or two.",
      editSuccessPreview: "Done — here's the updated video.",
      scriptEditorTitle: "Script",
      scriptEditorHint: "This is the real narration script — edit the words, and the voiceover and captions update to match.",
      scriptEditorHook: "Hook",
      scriptEditorContext: "Context",
      scriptEditorValue: "Value",
      scriptEditorMessage: "Message",
      scriptEditorCta: "Call to action",
      scriptEditorRemoveSection: "Remove this section",
      scriptEditorRemoveLastWarning: "At least one section needs text.",
      scriptEditorSave: "Save script",
      scriptEditorSaving: "Re-rendering…",
      scriptEditorSaved: "Script updated.",
      sceneEditorTitle: "Scenes",
      sceneMediaSwap: "Swap media",
      sceneMediaSwapPickTitle: "Choose new media for this scene",
      sceneMediaSwapChooseAsset: "Choose from Media Library",
      sceneMediaSwapGenerateAi: "Generate a new AI background instead",
      sceneMediaSwapSave: "Use this",
      sceneMediaSwapSaving: "Re-rendering…",
      sceneMediaSwapCancel: "Cancel",
      sceneMediaSwapSaved: "Scene media updated.",
      sceneMediaUploadLabel: "Upload a new photo/video",
      sceneMediaUploading: "Uploading…",
      sceneMediaUploadError: "Could not upload that file.",
      sceneReorderDisabledNarrated: "Not available for narrated videos — reordering would desync the voiceover from what's on screen.",
      sceneDurationDisabledNarrated: "Not available for narrated videos — a scene's length follows the real narration timing.",
      sceneRemoveGuidanceNarrated: "To remove this scene, delete its text in the script editor above.",
      sceneMoveUp: "Move up",
      sceneMoveDown: "Move down",
      sceneDurationLabel: "Duration (seconds)",
      sceneOverlayTextLabel: "On-screen text",
      sceneRemoveButton: "Remove scene",
      sceneAddButton: "Add a scene",
      sceneNoPreview: "No preview yet",
      sceneThumbnailAlt: (n: number) => `Scene ${n}`,
      sceneRemoveAria: (n: number) => `Remove scene ${n}`,
      sceneDragHandleAria: (n: number) => `Drag to reorder scene ${n}`,
      sceneAddAria: "Add a new scene at the end",
      sceneJumpToScript: "Go to script",
      sceneJumpToScriptAria: (section: string) => `Jump to the "${section}" section in the script editor`,
      sceneMediaSwapUnavailableLegacy:
        "This scene can't be swapped — it was rendered before per-scene editing existed. Edit the script above to regenerate it with full scene control.",
      sceneEditorSave: "Save scenes",
      sceneEditorSaving: "Re-rendering…",
      sceneEditorSaved: "Scenes updated.",
      sceneCurrentMedia: "Current media",
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
      durationDetected: (days: number) => `Sounds like ${days} day${days === 1 ? "" : "s"} — use that?`,
      durationDetectedCapped: (requestedDays: number, cappedDays: number) =>
        `Sounds like about ${requestedDays} days — this app plans up to ${cappedDays} at a time.`,
      durationApply: "Use this",
      previewSingle: "This will create 1 post.",
      previewMulti: (days: number) => `This will create 1 video and ${days - 1} poster${days - 1 === 1 ? "" : "s"} over ${days} days.`,
      useAiBackgrounds: "Use AI backgrounds for this campaign's posters",
      useAiBackgroundsDisclosure:
        "Uses today's shared free AI quota — if it runs out partway through a large campaign, remaining posts automatically use your brand style instead. Off by default; your brand gradient always works with zero limits.",
      angleLabel: "Angle",
    },
    recurringPlan: {
      title: "Recurring plan",
      subtitle: "A standing rule that keeps generating and publishing content every day until you pause it.",
      entryLinkLabel: "Set up a recurring plan →",
      postsPerDay: "Posts per day",
      videosPerDay: "Videos per day",
      publishTimes: "Publish times",
      publishTimesHint: "24-hour, comma-separated",
      publishTimesPlaceholder: "e.g. 09:00, 17:00",
      targetPlatformsLabel: "Publish to",
      objectiveHint: "Topic hint (optional)",
      objectiveHintPlaceholder: "Leave blank to auto-pick a fresh topic each day",
      autoPublish: "Auto-publish — no approval needed",
      autoPublishWarning: "Auto-publish is ON — new content goes live automatically at its scheduled time, with no review step.",
      autoPublishDisabledHint: "Connect a publishing method (Settings → Publishing) to turn this on.",
      save: "Save recurring plan",
      saving: "Saving…",
      saved: "Saved.",
      pause: "Pause",
      resume: "Resume",
      deleteButton: "Delete recurring plan",
      deleteConfirm: "Delete this recurring plan? Content it already generated stays — only future runs stop.",
      deleted: "Recurring plan deleted.",
      activeBanner: "Active — generating new content every day.",
      pausedBanner: "Paused — no new content will be generated until you resume.",
      cronPrecisionNote:
        "Publish times are real targets, not guaranteed to the minute — this app checks once a day, so content publishes at the next check after its scheduled time.",
      activityTitle: "Generated so far",
      noActivityYet: "Nothing generated yet — the first batch appears after the next daily run.",
      errorLabel: (message: string) => `Last run failed: ${message}`,
      autoPublishItemLabel: (time: string) => `Will auto-publish at ${time}`,
    },
    publish: {
      title: "Publish",
      subtitle: "Post an existing poster or video directly to a connected Facebook, Instagram, LinkedIn, or TikTok account.",
      connectedSuccess: "Connected successfully.",
      connectedError: (detail: string) => `Couldn't connect: ${detail}`,
      noPostersYetPrefix: "No posters yet — generate one in the",
      noPostersYetSuffix: "first.",
      connectFirst: "Connect a Facebook, Instagram, LinkedIn, or TikTok account above before you can publish.",
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
      autoSchedule: "Auto-Schedule Peak Time",
      autoScheduling: "Finding the best time…",
      autoScheduleAppliedDefault: "Set to a typical GCC peak-engagement hour — you don't have enough measured posts yet for a personalized time.",
      autoScheduleAppliedLearned: (sampleSize: number) =>
        `Set to your company's own real peak engagement hour, based on ${sampleSize} measured posts.`,
      queuePost: "Queue post",
      queuing: "Queuing…",
      history: "Publish history",
      posterRemoved: "(poster removed)",
      scheduledFor: "Scheduled for",
      attempted: "Attempted",
      viewPost: "View post",
      platformFacebook: "Facebook Page",
      platformInstagram: "Instagram",
      platformLinkedIn: "LinkedIn Page",
      platformTikTok: "TikTok",
      video: "Video",
      noVideosYet: "No videos yet — generate one in the video studio first.",
      connectLinkedIn: "Connect LinkedIn",
      connectTikTok: "Connect TikTok",
      pendingAppReview:
        "Pending platform app review — publishing works, but posts stay private until the developer app is approved.",
    },
    media: {
      title: "Media Library",
      subtitle: (name: string) =>
        `Photos, video, audio, and brand assets for ${name}. Tags shown here are structural only — semantic search arrives once AI tagging is built.`,
      noMedia: "No media uploaded yet.",
      noMediaHint: "Add your logo, product photos, or site footage — they'll show up here and become real building blocks for your posters and videos.",
      uploadHint: "Photos, videos, or audio — up to 25MB each.",
      upload: "Upload",
      noLongerAvailable: "No longer available",
      uploading: "Uploading…",
      activityTitle: "Recent activity",
      activityPublished: (label: string) => `Published: ${label}`,
      activityPublishFailed: (label: string) => `Publish failed: ${label}`,
      activityGenerationFailed: (label: string) => `${label} — a post failed to generate`,
      uploadFilesLabel: "Choose photos, videos, or audio files to upload",
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
      importNoLogo: "We couldn't find a logo or icon on this page — you can upload one manually below.",
      importNoColors:
        "We couldn't find explicit brand colors on this page — some sites render their styling entirely in JavaScript, which this lightweight scan can't see. You can set colors manually below.",
      importNoFonts:
        "We couldn't find explicit font names on this page — some sites render their styling entirely in JavaScript, which this lightweight scan can't see. You can set fonts manually below.",
      importReviewHint: "Review the extracted values below, then click Save Brand Kit to apply them.",
      importApplied: "Applied",
      importContextFound: "Business context",
      importNoContext: "We couldn't derive business context from this page.",
      importDescriptionFound: "Business description",
      importToneFound: "Tone of voice",
      importProductsFound: "Products or services mentioned",
      importNoProducts: "No specific products or services were clearly mentioned on this page.",
      importApplyContext: "Apply to Company Profile",
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
      fishAudioGuideTitle: "Fish Audio (lower-cost voiceovers)",
      fishAudioGuideSteps: [
        "Go to fish.audio and create an account.",
        "Open fish.audio/app/api-keys → \"Create New Key\".",
        "Name it \"Postify\" and copy the key.",
        "Paste it into the API key field above, choose Fish Audio as the provider, and save.",
        "In the voiceover engine section above, switch to \"Use my own API key\" so videos actually use it.",
      ],
      fishAudioGuideLinkLabel: "Get Fish Audio key → fish.audio",
      fishAudioCostNote:
        "Fish Audio's per-character rate (~$15 per 1M characters on its S2.1 Pro model) is typically well below ElevenLabs' — a real cost-conscious option, not a lower-quality one. Either provider works equally well here; pick whichever fits your budget.",
      geminiGuideTitle: "Google Gemini (free AI writing + lower-cost AI backgrounds)",
      geminiGuideSteps: [
        "Go to aistudio.google.com and sign in with a Google account.",
        "Open aistudio.google.com/apikey → \"Create API key\".",
        "Copy the key.",
        "Paste it into the API key field above, choose Google Gemini as the provider, and save.",
        "That's it for captions/scripts — Gemini's text models have a genuine free tier, no billing needed. AI image backgrounds are separate: enable billing on the linked Google Cloud project only if you also want those (Gemini's image models have no free tier).",
      ],
      geminiGuideLinkLabel: "Get Gemini key → aistudio.google.com",
      geminiCostNote:
        "Gemini's image model (gemini-3.1-flash-lite-image) costs about $0.034 per image, with no free tier — billing must be enabled from the very first image. That's typically cheaper than OpenAI's gpt-image-1 (roughly $0.01–$0.17 per image depending on quality). Both are real, equally valid choices — pick whichever fits your budget.",
      geminiTextFreeNote:
        "Gemini's text models (captions, scripts) have a genuine, permanent free tier — no credit card, no cost. One real tradeoff: on the free tier, human reviewers may read and use submitted content to improve Google's models (disconnected from your account first). The same key you save here works for both AI writing and AI backgrounds — no need to enter it twice.",
      musicCreditsTitle: "Music credits",
      musicCreditsSubtitle: "Background music used in your generated videos.",
      musicCreditsLicenseNote:
        "All tracks are by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0 — free for commercial use with attribution.",
      musicCreditsLicenseLinkLabel: "View license → creativecommons.org",
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
      preferencesTitle: "What we've noticed from how you use Postify",
      preferencesSubtitle:
        "Based on what you delete, publish, edit, and regenerate — not something you have to rate or teach us directly.",
      preferencesNoData:
        "Not enough activity yet to notice a real pattern. As you delete, publish, and edit content, what we notice will show up here.",
      preferencesPositive: (dimensionLabel: string, value: string) =>
        `You tend to keep and publish ${dimensionLabel} content like "${value}" — we're leaning toward suggesting more of it.`,
      preferencesNegative: (dimensionLabel: string, value: string) =>
        `You tend to delete or move away from ${dimensionLabel} content like "${value}" — we're suggesting it less often.`,
      dimensionTopic: "topic",
      dimensionTemplate: "template",
      dimensionTone: "tone",
      dimensionVisualStyle: "visual style",
      lockButton: "Lock this",
      unlockButton: "Unlock",
      lockedBadge: "Locked — won't change from new activity",
      resetButton: "Reset what we've learned",
      resetConfirm:
        "This clears everything learned from your deletes, publishes, edits, and regenerations, and unlocks any locked topics. It does not affect your real published-post engagement history. Continue?",
      resetDone: "Reset. We'll start noticing patterns again as you use Postify.",
      resetHint: "This only resets usage-pattern learning above — not your real measured post-performance history below.",
      teachTitle: "Teach AI",
      teachSubtitle:
        "Tell us directly what you like or don't — mark content below, or upload your own example. This counts more than what we quietly notice above.",
      teachNoContent: "Generate a poster or video first, then come back here to mark it.",
      teachMoreLikeThis: "More like this",
      teachNeverLikeThis: "Never like this",
      teachMarked: "Marked — thanks, this is now feeding your Creative DNA.",
      teachExampleTitle: "Or upload an example",
      teachExampleSubtitle:
        "Have a photo or video from elsewhere that shows a style or topic you want? Upload it and tell us what it represents — we can't automatically analyze an outside image, so this is how you point us to it directly.",
      teachExampleFileLabel: "Choose a photo or video",
      teachExampleTopicPlaceholder: "What topic is this about? (optional)",
      teachExampleStylePlaceholder: "What visual style is this? (optional)",
      teachExampleSubmit: "Submit example",
      teachExampleSubmitting: "Uploading…",
      teachExampleDone: "Thanks — this is now feeding your Creative DNA.",
      dangerZoneTitle: "Danger zone",
      dangerZoneSubtitle: "Permanently delete this company and everything in it.",
      deleteCompanyButton: "Delete this company",
      deleteCompanyConfirmTitle: "Delete company permanently?",
      deleteCompanyConfirmBody: (companyName: string) =>
        `This permanently deletes ${companyName} — every poster, video, campaign, uploaded photo, brand kit, connected account, and everything Postify has learned about your brand. This cannot be undone.`,
      deleteCompanyConfirmLabel: (companyName: string) => `Type "${companyName}" to confirm`,
      deleteCompanyConfirmPlaceholder: "Company name",
      deleteCompanySubmit: "Permanently delete",
      deleteCompanyDeleting: "Deleting…",
      deleteCompanyCancel: "Cancel",
      deleteCompanyMismatch: "That doesn't match the company name.",
      deleteCompanyNotOwner: "Only the account that created this company can delete it.",
      scopeSectionLabel: "Where should this key work?",
      scopeSharedOption: "Use this key for all my companies",
      scopeSharedOptionHint: "Any company you own can use it — you won't have to paste it in again.",
      scopeCompanyOnlyOption: "Just this company",
      scopeCompanyOnlyOptionHint: "Your other companies won't have access to this key.",
      scopeSharedBadge: "Shared across all your companies",
      scopeCompanyOnlyBadge: (companyName: string) => `Only used for ${companyName}`,
      shareCredentialButton: "Share across my companies",
      shareCredentialConfirmTitle: "Share this key with all your companies?",
      shareCredentialConfirmBody: (provider: string) =>
        `Every company you own will be able to use this ${provider} key. You can stop sharing it again at any time.`,
      shareCredentialConfirmSubmit: "Share it",
      shareCredentialCancel: "Cancel",
      stopSharingButton: "Stop sharing",
      stopSharingConfirmTitle: "Stop sharing this key?",
      stopSharingImpactBody: (companyNames: string) =>
        `These companies are currently using this shared key and will lose access immediately: ${companyNames}. They can add their own key afterward.`,
      stopSharingNoImpactBody: "No other company of yours is currently using this shared key.",
      stopSharingConfirmSubmit: "Stop sharing",
      stopSharingCancel: "Cancel",
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
    socialPreview: {
      trigger: "Preview",
      title: "Preview on Social Media",
      close: "Close",
      disclaimer: "A visual preview only — publishing only actually happens for your connected accounts.",
      tabInstagram: "Instagram",
      tabFacebook: "Facebook",
      tabLinkedin: "LinkedIn",
      tabTiktok: "TikTok",
      cropWarning: "This layout crops to a vertical frame — anything outside it won't be shown.",
      captionPlaceholder: "Your caption will appear here.",
      justNow: "Just now",
      originalAudio: "original audio",
      companyPage: "Company",
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
      createContent: "إنشاء محتوى",
      help: "المساعدة",
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
      skipToContent: "تخطَّ إلى المحتوى",
      fallbackNotice: (currentProvider: string, originalProvider: string) =>
        `تم الإنشاء باستخدام ${currentProvider} — واجه ${originalProvider} مشكلة هذه المرة.`,
      fallbackNoticeGeneric: (originalProvider: string) =>
        `واجه ${originalProvider} مشكلة أثناء هذا الإنشاء — تم استخدام بديل مجاني لهذا الجزء تلقائيًا.`,
    },
    company: {
      switcherLabel: "تبديل الشركة",
      addAnother: "إضافة شركة أخرى",
      switchError: "تعذّر تبديل الشركة — يرجى المحاولة مرة أخرى.",
    },
    errorBoundary: {
      title: "حدث خطأ ما",
      message:
        "واجهت هذه الصفحة خطأً حقيقيًا ولم تكتمل — قد يحدث هذا عندما يستغرق طلب ما (مثل إنتاج فيديو بتعليق صوتي) وقتًا طويلاً جدًا أو ينقطع الاتصال في منتصف الطريق. عملك الآخر بأمان.",
      tryAgain: "حاول مجددًا",
      goToStudio: "الذهاب إلى استوديو المحتوى",
    },
    voiceInput: {
      startLabel: "تحدّث بدلاً من الكتابة",
      listeningLabel: "جارٍ الاستماع… اضغط للإيقاف",
      errorNotAllowed: "تم حظر الوصول إلى الميكروفون — فعِّله من إعدادات المتصفح لاستخدام الإدخال الصوتي.",
      errorNoSpeech: "لم يتم التقاط أي صوت — حاول مرة أخرى.",
      errorNetwork: "يحتاج الإدخال الصوتي إلى اتصال بالإنترنت الآن.",
      errorGeneric: "لم يعمل الإدخال الصوتي — حاول مرة أخرى أو اكتب بدلاً من ذلك.",
    },
    topicGuard: {
      suggestionsLabel: "اقتراحات",
      blockedGeneric: "هذا لا يبدو موضوعًا — جرّب شيئًا مثل \"إطلاق منتج جديد\"، أو اختر اقتراحًا أدناه.",
      blockedNoClarify: "هذا لا يبدو موضوعًا، ولم نتمكن من تحديد ما تقصده بثقة — جرّب شيئًا مثل \"إطلاق منتج جديد\"، أو اختر اقتراحًا أدناه.",
      clarifiedNotice: (used: string) => `استخدمنا "${used}" كموضوع بدلاً مما تمت كتابته.`,
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
      targetMarket: "السوق المستهدف",
      targetMarketHint: "(اختياري)",
      targetMarketPlaceholder: "مثال: أبوظبي والعين، أو على مستوى الدولة (B2B)",
      language: "اللغة",
      languageHint: "يمكنك تغيير هذا لاحقًا.",
      submit: "إنشاء الشركة",
      submitPending: "جارٍ الإنشاء…",
      websiteFirstTitle: "هل لديك موقع إلكتروني؟",
      websiteFirstSubtitle: "الصق الرابط وسنقوم بإعداد معظم هذا نيابة عنك.",
      websiteUrlPlaceholder: "yourcompany.com",
      extractButton: "استخراج",
      extracting: "جارٍ تحليل موقعك…",
      skipManual: "سأقوم بإعداد هذا يدويًا",
      backToWebsite: "لديك موقع إلكتروني بدلًا من ذلك؟",
      reviewTitle: "إليك ما وجدناه",
      reviewSubtitle: "راجع وعدّل أي شيء أدناه، ثم تابع.",
      reviewLogo: "الشعار",
      reviewNoLogo: "لم نتمكن من العثور على شعار — يمكنك إضافة واحد لاحقًا من إعدادات هوية العلامة.",
      reviewColors: "ألوان العلامة",
      reviewNoColors: "لم نتمكن من العثور على ألوان علامة واضحة في هذه الصفحة — يمكنك ضبطها لاحقًا.",
      reviewFonts: "الخطوط",
      reviewNoFonts: "لم نتمكن من العثور على أسماء خطوط واضحة في هذه الصفحة — يمكنك ضبطها لاحقًا.",
      reviewDescription: "وصف العمل",
      reviewTone: "نبرة الصوت",
      industrySuggestedHint: "(مقترح من موقعك — غيّره إذا لزم الأمر)",
      createAndContinue: "إنشاء الشركة",
      creating: "جارٍ الإنشاء…",
      geminiStepTitle: "تريد كتابة أفضل وأكثر طبيعية بالذكاء الاصطناعي؟",
      geminiStepBody:
        "قوالبنا الجاهزة تعمل جيدًا دائمًا. لكن ربط حساب Google Gemini المجاني يمنحك تعليقات ونصوصًا أكثر طبيعية وتنوعًا — يستغرق الأمر دقيقتين تقريبًا، بلا بطاقة ائتمان وبلا أي تكلفة.",
      geminiStepDisclosure:
        "مقايضة حقيقية تستحق المعرفة: في الخطة المجانية، قد يطّلع مراجعون بشريون على ما ترسله ويستخدمونه لتحسين نماذج Google (بعد فصله عن حسابك). تخطَّ هذه الخطوة إن كنت تفضّل عدم مشاركة محتوى عملك بهذه الطريقة — القوالب تظل تعمل بكامل كفاءتها في الحالتين.",
      geminiStepGetKeyLink: "احصل على مفتاح مجاني ← aistudio.google.com",
      geminiStepApiKeyPlaceholder: "الصق مفتاح Gemini الخاص بك",
      geminiStepConnect: "ربط Gemini",
      geminiStepConnecting: "جارٍ الربط…",
      geminiStepSkip: "تخطَّ الآن",
      geminiStepConnected: "تم الربط — ستحصل على كتابة Gemini من الآن فصاعدًا.",
    },
    studio: {
      title: "استوديو المحتوى",
      subtitle: (name: string) => `أنشئ منشورًا لوسائل التواصل الاجتماعي لـ${name}، بأسلوب يلائم مجالك وهوية علامتك.`,
      topicPlaceholder: "عن ماذا هذا المنشور؟ مثال: قائمة طعامنا الجديدة لفصل الربيع",
      generate: "إنشاء",
      generating: "جارٍ الإنشاء…",
      geminiNudgeText: "احصل على كتابة أفضل مجانًا — اربط Gemini خلال دقيقتين.",
      geminiNudgeDismiss: "إغلاق",
      sharedAiExhaustedText:
        "انتهت حصة الذكاء الاصطناعي المجاني لهذا اليوم — القوالب لا تزال تعمل، أو اربط مفتاح Gemini المجاني الخاص بك في الإعدادات للوصول غير المحدود.",
    },
    wizard: {
      stepOf: (step: number) => `الخطوة ${step} من 3`,
      step1Title: "عمّ سننشر؟",
      step1Subtitle: (name: string) => `ابدأ بموضوع لـ${name} — أو دعنا نقترح واحدًا.`,
      topicLabel: "الموضوع",
      topicPlaceholder: "عن ماذا هذا المنشور؟ مثال: قائمة طعامنا الجديدة لفصل الربيع",
      autoGenerate: "اقترح فكرة اليوم تلقائيًا",
      autoGenerateHint: "فكرة اليوم المقترحة — نفس الفكرة طوال اليوم بالتصميم. تريد فكرة مختلفة الآن؟",
      showAnotherIdea: "أرني فكرة أخرى",
      generate: "إنشاء",
      generating: "جارٍ الإنشاء…",
      chooseHint: "اختر التسمية التوضيحية التي تفضلها — يمكنك تعديلها في الخطوة التالية.",
      hashtagsLabel: "وسوم مقترحة",
      nextCreateAsset: "التالي: إنشاء المحتوى",
      step2Title: "حوّله إلى ملصق أو فيديو",
      toggleStaticPoster: "ملصق ثابت",
      toggleMotionVideo: "فيديو متحرك",
      nextPreviewPublish: "التالي: معاينة ونشر",
      step3Title: "معاينة ونشر",
      step3Subtitle: "شاهد كيف يبدو هذا عبر المنصات، ثم انشره أو جدوله.",
      autoScheduledLabel: "الوقت المقترح",
      autoScheduledLearned: (n: number) => `ساعة ذروة تفاعلك الحقيقية، بناءً على ${n} منشورًا تم قياسه.`,
      autoScheduledDefault: "ساعة ذروة تفاعل نموذجية لمنطقة الخليج — لا يوجد بعد عدد كافٍ من المنشورات المقاسة لوقت مخصص.",
      publishNow: "انشر الآن",
      scheduleCampaign: "جدولة الحملة",
      backToEdit: "العودة للتعديل",
      startOver: "البدء من جديد",
      videoPublishUnavailable:
        "يتطلب النشر المباشر للفيديو ربط حساب تيك توك — فيسبوك وإنستغرام ولينكدإن لا تدعم الفيديو هنا بعد. اربط تيك توك من صفحة النشر، أو نزّل الفيديو أدناه.",
      downloadVideo: "تنزيل الفيديو",
      durationSuggestion: (days: number) => `يبدو أن هذا طلب لحوالي ${days} يوم من المحتوى، وليس منشورًا واحدًا فقط.`,
      durationSuggestionCapped: (requestedDays: number, cappedDays: number) =>
        `يبدو هذا طلبًا لحوالي ${requestedDays} يومًا — هذا التطبيق يخطط حتى ${cappedDays} يومًا في المرة الواحدة، فسيبدأ بها.`,
      durationSuggestionAction: "إنشاء حملة كاملة بدلاً من ذلك",
      durationSuggestionDismiss: "لا، منشور واحد فقط",
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
      regenerateBackground: "إعادة توليد الخلفية",
      regeneratingBackground: "جارٍ إعادة التوليد…",
      regenerateBackgroundSuccess: "تم توليد خلفية جديدة — شاهدها أعلاه.",
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
        "لم يتم رفع صور أو فيديوهات بعد — قم بزيارة مكتبة الوسائط أولًا، أو اعتمد على مرئيات الذكاء الاصطناعي المجانية (أضف مفتاح OpenAI أو Gemini في الإعدادات لجودة أعلى وأكثر ثباتًا).",
      kindVideo: "فيديو",
      kindPhoto: "صورة",
      generatedSuccess: "تم إنشاء الفيديو — شاهده أدناه.",
      generate: "إنشاء الفيديو",
      generating: "جارٍ الإنشاء… قد يستغرق ذلك دقيقة",
      generatingSlowNotice: "لا يزال العمل جاريًا — الفيديوهات ذات التعليق الصوتي الحقيقي والترجمة تستغرق وقتًا أطول من الفيديوهات الثابتة.",
      generatingVerySlowWarning:
        "هذا يستغرق وقتًا أطول من المتوقع. إذا لم ينتهِ قريبًا، جرّب نصًا أقصر، أو مشاهد أقل، أو أوقف التعليق الصوتي وحاول مجددًا.",
      generatingSilentFailure:
        "حدث خطأ ولم يكتمل إنشاء الفيديو — قد يحدث هذا عندما يستغرق الإنتاج وقتًا طويلاً جدًا. جرّب نصًا أقصر، أو مشاهد أقل، أو أوقف التعليق الصوتي، ثم أنشئ الفيديو مجددًا.",
      motionTemplate: "أسلوب الحركة",
      motionTemplateStandard: "قياسي",
      motionTemplateStandardHint: "مشاهد وترجمة وشعارك — دون رسوميات حركية إضافية.",
      motionTemplateLowerThird: "شريط ترويجي سفلي",
      motionTemplateLowerThirdHint: "شريط متحرك ينزلق خلال الافتتاحية ودعوة اتخاذ الإجراء.",
      motionTemplateWaveform: "موجة صوتية",
      motionTemplateWaveformHint: "شريط موجة صوتية حي يتفاعل مع التعليق الصوتي والموسيقى فوق الترجمة.",
      editVideo: "تعديل الفيديو",
      editVideoLoading: "جارٍ تحميل الفيديو…",
      editVideoTrimStart: "بداية القص",
      editVideoTrimEnd: "نهاية القص",
      editVideoOverlayText: "نص فوق الفيديو",
      editVideoOverlayPlaceholder: "مثال: لفترة محدودة فقط",
      editVideoSave: "حفظ التعديل",
      editVideoSaving: "جارٍ حفظ التعديل…",
      editVideoSaved: "تم الحفظ — سيظهر الفيديو المُحدَّث على البطاقة.",
      editVideoCancel: "إلغاء",
      editReRendersWholeVideo: "الحفظ يعيد إنتاج الفيديو بالكامل بتعليق صوتي وترجمة جديدين — قد يستغرق ذلك دقيقة أو دقيقتين.",
      editSuccessPreview: "تم — هذا هو الفيديو المُحدَّث.",
      scriptEditorTitle: "النص",
      scriptEditorHint: "هذا هو نص التعليق الصوتي الفعلي — عدّل الكلمات، وسيتم تحديث التعليق الصوتي والترجمة تلقائيًا لتطابقه.",
      scriptEditorHook: "الافتتاحية",
      scriptEditorContext: "السياق",
      scriptEditorValue: "القيمة",
      scriptEditorMessage: "الرسالة",
      scriptEditorCta: "دعوة لاتخاذ إجراء",
      scriptEditorRemoveSection: "حذف هذا القسم",
      scriptEditorRemoveLastWarning: "يجب أن يحتوي قسم واحد على الأقل على نص.",
      scriptEditorSave: "حفظ النص",
      scriptEditorSaving: "جارٍ إعادة الإنتاج…",
      scriptEditorSaved: "تم تحديث النص.",
      sceneEditorTitle: "المشاهد",
      sceneMediaSwap: "تبديل الوسائط",
      sceneMediaSwapPickTitle: "اختر وسائط جديدة لهذا المشهد",
      sceneMediaSwapChooseAsset: "اختر من مكتبة الوسائط",
      sceneMediaSwapGenerateAi: "أو أنشئ خلفية جديدة بالذكاء الاصطناعي",
      sceneMediaSwapSave: "استخدم هذا",
      sceneMediaSwapSaving: "جارٍ إعادة الإنتاج…",
      sceneMediaSwapCancel: "إلغاء",
      sceneMediaSwapSaved: "تم تحديث وسائط المشهد.",
      sceneMediaUploadLabel: "تحميل صورة/فيديو جديد",
      sceneMediaUploading: "جارٍ التحميل…",
      sceneMediaUploadError: "تعذّر تحميل هذا الملف.",
      sceneReorderDisabledNarrated: "غير متاح للفيديوهات ذات التعليق الصوتي — إعادة الترتيب ستُفقد تزامن التعليق الصوتي مع ما يظهر على الشاشة.",
      sceneDurationDisabledNarrated: "غير متاح للفيديوهات ذات التعليق الصوتي — مدة المشهد تتبع توقيت التعليق الصوتي الفعلي.",
      sceneRemoveGuidanceNarrated: "لحذف هذا المشهد، احذف نصه من محرّر النص أعلاه.",
      sceneMoveUp: "تحريك لأعلى",
      sceneMoveDown: "تحريك لأسفل",
      sceneDurationLabel: "المدة (بالثواني)",
      sceneOverlayTextLabel: "النص الظاهر على الشاشة",
      sceneRemoveButton: "حذف المشهد",
      sceneAddButton: "إضافة مشهد",
      sceneNoPreview: "لا توجد معاينة بعد",
      sceneThumbnailAlt: (n: number) => `المشهد ${n}`,
      sceneRemoveAria: (n: number) => `حذف المشهد ${n}`,
      sceneDragHandleAria: (n: number) => `اسحب لإعادة ترتيب المشهد ${n}`,
      sceneAddAria: "إضافة مشهد جديد في النهاية",
      sceneJumpToScript: "الانتقال إلى النص",
      sceneJumpToScriptAria: (section: string) => `الانتقال إلى قسم "${section}" في محرّر النص`,
      sceneMediaSwapUnavailableLegacy:
        "لا يمكن تبديل وسائط هذا المشهد — تم إنشاؤه قبل إتاحة التعديل لكل مشهد على حدة. عدّل النص أعلاه لإعادة إنشائه بتحكم كامل بالمشاهد.",
      sceneEditorSave: "حفظ المشاهد",
      sceneEditorSaving: "جارٍ إعادة الإنتاج…",
      sceneEditorSaved: "تم تحديث المشاهد.",
      sceneCurrentMedia: "الوسائط الحالية",
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
      durationDetected: (days: number) => `يبدو أنك تطلب ${days} يومًا — هل تريد استخدام ذلك؟`,
      durationDetectedCapped: (requestedDays: number, cappedDays: number) =>
        `يبدو هذا طلبًا لحوالي ${requestedDays} يومًا — هذا التطبيق يخطط حتى ${cappedDays} يومًا في المرة الواحدة.`,
      durationApply: "استخدام هذا",
      previewSingle: "سيؤدي هذا إلى إنشاء منشور واحد.",
      previewMulti: (days: number) => `سيؤدي هذا إلى إنشاء فيديو واحد و${days - 1} منشور خلال ${days} يومًا.`,
      useAiBackgrounds: "استخدام خلفيات بالذكاء الاصطناعي لمنشورات هذه الحملة",
      useAiBackgroundsDisclosure:
        "يستخدم حصة الذكاء الاصطناعي المجانية المشتركة لليوم — إذا نفدت في منتصف حملة كبيرة، ستستخدم المنشورات المتبقية أسلوب علامتك التجارية تلقائيًا. معطّل افتراضيًا؛ التدرج اللوني لعلامتك يعمل دائمًا بلا حدود.",
      angleLabel: "الزاوية",
    },
    recurringPlan: {
      title: "الخطة المتكررة",
      subtitle: "قاعدة ثابتة تستمر في إنشاء المحتوى ونشره كل يوم حتى توقفها.",
      entryLinkLabel: "إعداد خطة متكررة ←",
      postsPerDay: "منشورات يوميًا",
      videosPerDay: "فيديوهات يوميًا",
      publishTimes: "أوقات النشر",
      publishTimesHint: "بصيغة 24 ساعة، مفصولة بفواصل",
      publishTimesPlaceholder: "مثال: 09:00، 17:00",
      targetPlatformsLabel: "النشر إلى",
      objectiveHint: "تلميح الموضوع (اختياري)",
      objectiveHintPlaceholder: "اتركه فارغًا لاختيار موضوع جديد تلقائيًا كل يوم",
      autoPublish: "النشر التلقائي — بلا حاجة للموافقة",
      autoPublishWarning: "النشر التلقائي مُفعّل — سيُنشر المحتوى الجديد تلقائيًا في موعده المحدد، دون مراجعة.",
      autoPublishDisabledHint: "اربط طريقة نشر حقيقية (الإعدادات ← النشر) لتفعيل هذا الخيار.",
      save: "حفظ الخطة المتكررة",
      saving: "جارٍ الحفظ…",
      saved: "تم الحفظ.",
      pause: "إيقاف مؤقت",
      resume: "استئناف",
      deleteButton: "حذف الخطة المتكررة",
      deleteConfirm: "حذف هذه الخطة المتكررة؟ المحتوى الذي أُنشئ بالفعل يبقى — فقط عمليات التشغيل المستقبلية تتوقف.",
      deleted: "تم حذف الخطة المتكررة.",
      activeBanner: "نشِطة — يُنشأ محتوى جديد كل يوم.",
      pausedBanner: "متوقفة مؤقتًا — لن يُنشأ محتوى جديد حتى الاستئناف.",
      cronPrecisionNote:
        "أوقات النشر أهداف حقيقية وليست مضمونة إلى الدقيقة — يتحقق هذا التطبيق مرة واحدة يوميًا، فيُنشر المحتوى عند أول تحقق بعد موعده المحدد.",
      activityTitle: "ما تم إنشاؤه حتى الآن",
      noActivityYet: "لم يُنشأ شيء بعد — ستظهر أول دفعة بعد التشغيل اليومي التالي.",
      errorLabel: (message: string) => `فشلت آخر عملية تشغيل: ${message}`,
      autoPublishItemLabel: (time: string) => `سيُنشر تلقائيًا الساعة ${time}`,
    },
    publish: {
      title: "النشر",
      subtitle: "انشر ملصقًا أو فيديو جاهزًا مباشرة إلى حساب فيسبوك أو إنستغرام أو لينكدإن أو تيك توك متصل.",
      connectedSuccess: "تم الربط بنجاح.",
      connectedError: (detail: string) => `تعذّر الربط: ${detail}`,
      noPostersYetPrefix: "لا توجد ملصقات بعد — أنشئ واحدًا في",
      noPostersYetSuffix: "أولًا.",
      connectFirst: "اربط حساب فيسبوك أو إنستغرام أو لينكدإن أو تيك توك أعلاه قبل أن تتمكن من النشر.",
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
      autoSchedule: "جدولة تلقائية لوقت الذروة",
      autoScheduling: "جارٍ إيجاد أفضل وقت…",
      autoScheduleAppliedDefault: "تم الضبط على ساعة ذروة تفاعل نموذجية لمنطقة الخليج — لا تملك بعد عددًا كافيًا من المنشورات المقاسة لوقت مخصص.",
      autoScheduleAppliedLearned: (sampleSize: number) =>
        `تم الضبط على ساعة الذروة الحقيقية لشركتك، بناءً على ${sampleSize} منشورًا تم قياسه.`,
      queuePost: "جدولة المنشور",
      queuing: "جارٍ الجدولة…",
      history: "سجل النشر",
      posterRemoved: "(تم حذف الملصق)",
      scheduledFor: "مجدول لـ",
      attempted: "تمت المحاولة في",
      viewPost: "عرض المنشور",
      platformFacebook: "صفحة فيسبوك",
      platformInstagram: "إنستغرام",
      platformLinkedIn: "صفحة لينكدإن",
      platformTikTok: "تيك توك",
      video: "الفيديو",
      noVideosYet: "لا توجد فيديوهات بعد — أنشئ واحدًا في استوديو الفيديو أولًا.",
      connectLinkedIn: "ربط لينكدإن",
      connectTikTok: "ربط تيك توك",
      pendingAppReview:
        "بانتظار مراجعة المنصة للتطبيق — النشر يعمل فعليًا، لكن المنشورات تبقى خاصة حتى تتم الموافقة على تطبيق المطوّر.",
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
      noLongerAvailable: "لم يعد متاحًا",
      activityTitle: "النشاط الأخير",
      activityPublished: (label: string) => `تم النشر: ${label}`,
      activityPublishFailed: (label: string) => `فشل النشر: ${label}`,
      activityGenerationFailed: (label: string) => `${label} — فشل إنشاء أحد المنشورات`,
      uploadFilesLabel: "اختر صورًا أو فيديوهات أو ملفات صوتية لرفعها",
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
      importNoLogo: "لم نتمكن من العثور على شعار أو أيقونة في هذه الصفحة — يمكنك رفع واحد يدويًا أدناه.",
      importNoColors:
        "لم نتمكن من العثور على ألوان علامة تجارية واضحة في هذه الصفحة — بعض المواقع تعرض تنسيقها بالكامل عبر جافاسكريبت، وهو ما لا يستطيع هذا الفحص الخفيف رؤيته. يمكنك ضبط الألوان يدويًا أدناه.",
      importNoFonts:
        "لم نتمكن من العثور على أسماء خطوط واضحة في هذه الصفحة — بعض المواقع تعرض تنسيقها بالكامل عبر جافاسكريبت، وهو ما لا يستطيع هذا الفحص الخفيف رؤيته. يمكنك ضبط الخطوط يدويًا أدناه.",
      importReviewHint: "راجع القيم المستخرجة أدناه، ثم اضغط على حفظ هوية العلامة لتطبيقها.",
      importApplied: "تم التطبيق",
      importContextFound: "سياق العمل",
      importNoContext: "لم نتمكن من استخلاص سياق العمل من هذه الصفحة.",
      importDescriptionFound: "وصف العمل",
      importToneFound: "نبرة الصوت",
      importProductsFound: "المنتجات أو الخدمات المذكورة",
      importNoProducts: "لم يُذكر أي منتج أو خدمة محددة بوضوح في هذه الصفحة.",
      importApplyContext: "تطبيق على ملف الشركة",
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
      fishAudioGuideTitle: "Fish Audio (تعليق صوتي بتكلفة أقل)",
      fishAudioGuideSteps: [
        "اذهب إلى fish.audio وأنشئ حسابًا.",
        "افتح fish.audio/app/api-keys ← \"Create New Key\".",
        "سمِّه \"Postify\" وانسخ المفتاح.",
        "الصقه في حقل مفتاح API أعلاه، اختر Fish Audio كمزوّد، ثم احفظ.",
        "في قسم محرك التعليق الصوتي أعلاه، بدّل إلى \"استخدام مفتاح API الخاص بي\" ليتم استخدامه فعليًا في الفيديوهات.",
      ],
      fishAudioGuideLinkLabel: "احصل على مفتاح Fish Audio ← fish.audio",
      fishAudioCostNote:
        "سعر Fish Audio لكل حرف (حوالي 15 دولارًا لكل مليون حرف على نموذج S2.1 Pro) عادة أقل بكثير من ElevenLabs — خيار موفّر حقيقي، وليس أقل جودة. كلا المزوّدين يعمل بشكل جيد هنا؛ اختر ما يناسب ميزانيتك.",
      geminiGuideTitle: "Google Gemini (كتابة مجانية بالذكاء الاصطناعي + خلفيات بتكلفة أقل)",
      geminiGuideSteps: [
        "اذهب إلى aistudio.google.com وسجّل الدخول بحساب Google.",
        "افتح aistudio.google.com/apikey ← \"Create API key\".",
        "انسخ المفتاح.",
        "الصقه في حقل مفتاح API أعلاه، اختر Google Gemini كمزوّد، ثم احفظ.",
        "هذا كل ما تحتاجه للتعليقات والنصوص — نماذج Gemini النصية لها مستوى مجاني حقيقي، بلا فوترة. خلفيات الصور بالذكاء الاصطناعي منفصلة: فعِّل الفوترة على مشروع Google Cloud المرتبط فقط إذا أردتها أيضًا (نماذج الصور ليس لها مستوى مجاني).",
      ],
      geminiGuideLinkLabel: "احصل على مفتاح Gemini ← aistudio.google.com",
      geminiCostNote:
        "نموذج Gemini للصور (gemini-3.1-flash-lite-image) يكلّف حوالي 0.034 دولار لكل صورة، بدون مستوى مجاني — يجب تفعيل الفوترة من أول صورة. هذا عادة أقل تكلفة من gpt-image-1 من OpenAI (حوالي 0.01 إلى 0.17 دولار للصورة حسب الجودة). كلا الخيارين حقيقي وصالح تمامًا؛ اختر ما يناسب ميزانيتك.",
      geminiTextFreeNote:
        "نماذج Gemini النصية (التعليقات والنصوص) لها مستوى مجاني حقيقي ودائم — بلا بطاقة ائتمان وبلا أي تكلفة. مقايضة حقيقية واحدة: في الخطة المجانية، قد يطّلع مراجعون بشريون على المحتوى المُرسَل ويستخدمونه لتحسين نماذج Google (بعد فصله عن حسابك). المفتاح نفسه الذي تحفظه هنا يعمل للكتابة والخلفيات معًا — لا حاجة لإدخاله مرتين.",
      musicCreditsTitle: "حقوق الموسيقى",
      musicCreditsSubtitle: "الموسيقى الخلفية المستخدمة في الفيديوهات التي أنشأتها.",
      musicCreditsLicenseNote:
        "جميع المقطوعات من تأليف Kevin MacLeod (incompetech.com)، مرخّصة بموجب Creative Commons: By Attribution 4.0 — مجانية للاستخدام التجاري بشرط ذكر المصدر.",
      musicCreditsLicenseLinkLabel: "عرض الترخيص ← creativecommons.org",
      insightsTitle: "ما الذي ينجح",
      insightsNoData:
        "لا توجد منشورات كافية منشورة وقيست تفاعلاتها بعد — ستظهر هذه المعلومات بعد نشر عدة منشورات عبر حساب فيسبوك أو إنستغرام متصل.",
      insightsSentence: (topic: string, relativeScore: number) =>
        `منشورات "${topic}" تحقق تفاعلاً يعادل ${relativeScore}× متوسط تفاعلك.`,
      insightsConfidence: (tier: string, sampleSize: number) => `مستوى الثقة: ${tier} (استنادًا إلى ${sampleSize} منشورًا).`,
      confidenceLow: "منخفض",
      confidenceMedium: "متوسط",
      confidenceHigh: "عالٍ",
      preferencesTitle: "ما لاحظناه من طريقة استخدامك لـ Postify",
      preferencesSubtitle: "استنادًا إلى ما تحذفه وتنشره وتعدّله وتعيد توليده — وليس شيئًا عليك تقييمه أو تعليمنا إياه مباشرة.",
      preferencesNoData: "لا يوجد نشاط كافٍ بعد لملاحظة نمط حقيقي. مع حذفك ونشرك وتعديلك للمحتوى، سيظهر هنا ما نلاحظه.",
      preferencesPositive: (dimensionLabel: string, value: string) =>
        `تميل إلى الاحتفاظ بمحتوى ${dimensionLabel} مثل "${value}" ونشره — نميل إلى اقتراح المزيد منه.`,
      preferencesNegative: (dimensionLabel: string, value: string) =>
        `تميل إلى حذف محتوى ${dimensionLabel} مثل "${value}" أو الابتعاد عنه — نقترحه بشكل أقل.`,
      dimensionTopic: "الموضوع",
      dimensionTemplate: "القالب",
      dimensionTone: "النبرة",
      dimensionVisualStyle: "الأسلوب البصري",
      lockButton: "قفل هذا",
      unlockButton: "إلغاء القفل",
      lockedBadge: "مقفل — لن يتغير بنشاط جديد",
      resetButton: "إعادة تعيين ما تعلمناه",
      resetConfirm:
        "سيؤدي هذا إلى مسح كل ما تعلمناه من عمليات الحذف والنشر والتعديل وإعادة التوليد، وإلغاء قفل أي مواضيع مقفلة. لن يؤثر هذا على سجل أداء منشوراتك الفعلي. متابعة؟",
      resetDone: "تمت إعادة التعيين. سنبدأ في ملاحظة الأنماط مجددًا مع استخدامك لـ Postify.",
      resetHint: "هذا يعيد تعيين تعلّم أنماط الاستخدام أعلاه فقط — وليس سجل أداء منشوراتك الفعلي أدناه.",
      teachTitle: "علّم الذكاء الاصطناعي",
      teachSubtitle:
        "أخبرنا مباشرة بما يعجبك وما لا يعجبك — علّم على المحتوى أدناه، أو ارفع مثالًا خاصًا بك. هذا له وزن أكبر مما نلاحظه بصمت أعلاه.",
      teachNoContent: "أنشئ ملصقًا أو فيديو أولًا، ثم عد إلى هنا لتعليمه.",
      teachMoreLikeThis: "المزيد مثل هذا",
      teachNeverLikeThis: "لا تكرر هذا أبدًا",
      teachMarked: "تم التعليم — شكرًا، هذا يغذي الآن حمضك الإبداعي (Creative DNA).",
      teachExampleTitle: "أو ارفع مثالًا",
      teachExampleSubtitle:
        "هل لديك صورة أو فيديو من مكان آخر يُظهر أسلوبًا أو موضوعًا تريده؟ ارفعه وأخبرنا بما يمثله — لا يمكننا تحليل صورة خارجية تلقائيًا، لذا هذه هي طريقتك لتوجيهنا إليها مباشرة.",
      teachExampleFileLabel: "اختر صورة أو فيديو",
      teachExampleTopicPlaceholder: "عن أي موضوع هذا؟ (اختياري)",
      teachExampleStylePlaceholder: "ما هو الأسلوب البصري لهذا؟ (اختياري)",
      teachExampleSubmit: "إرسال المثال",
      teachExampleSubmitting: "جارٍ الرفع…",
      teachExampleDone: "شكرًا — هذا يغذي الآن حمضك الإبداعي (Creative DNA).",
      dangerZoneTitle: "منطقة الخطر",
      dangerZoneSubtitle: "احذف هذه الشركة وكل ما فيها نهائيًا.",
      deleteCompanyButton: "حذف هذه الشركة",
      deleteCompanyConfirmTitle: "هل تريد حذف الشركة نهائيًا؟",
      deleteCompanyConfirmBody: (companyName: string) =>
        `سيؤدي هذا إلى حذف ${companyName} نهائيًا — كل ملصق وفيديو وحملة وصورة مرفوعة وهوية بصرية وحساب متصل وكل ما تعلّمه Postify عن علامتك التجارية. لا يمكن التراجع عن هذا.`,
      deleteCompanyConfirmLabel: (companyName: string) => `اكتب "${companyName}" للتأكيد`,
      deleteCompanyConfirmPlaceholder: "اسم الشركة",
      deleteCompanySubmit: "حذف نهائي",
      deleteCompanyDeleting: "جارٍ الحذف…",
      deleteCompanyCancel: "إلغاء",
      deleteCompanyMismatch: "هذا لا يطابق اسم الشركة.",
      deleteCompanyNotOwner: "فقط الحساب الذي أنشأ هذه الشركة يمكنه حذفها.",
      scopeSectionLabel: "أين يجب أن يعمل هذا المفتاح؟",
      scopeSharedOption: "استخدم هذا المفتاح لكل شركاتي",
      scopeSharedOptionHint: "يمكن لأي شركة تملكها استخدامه — لن تحتاج إلى لصقه مرة أخرى.",
      scopeCompanyOnlyOption: "لهذه الشركة فقط",
      scopeCompanyOnlyOptionHint: "لن يكون لشركاتك الأخرى إمكانية الوصول إلى هذا المفتاح.",
      scopeSharedBadge: "مشترك بين جميع شركاتك",
      scopeCompanyOnlyBadge: (companyName: string) => `يُستخدم فقط لـ ${companyName}`,
      shareCredentialButton: "مشاركته بين شركاتي",
      shareCredentialConfirmTitle: "هل تريد مشاركة هذا المفتاح مع جميع شركاتك؟",
      shareCredentialConfirmBody: (provider: string) =>
        `ستتمكن كل شركة تملكها من استخدام مفتاح ${provider} هذا. يمكنك إيقاف مشاركته في أي وقت.`,
      shareCredentialConfirmSubmit: "شارِكه",
      shareCredentialCancel: "إلغاء",
      stopSharingButton: "إيقاف المشاركة",
      stopSharingConfirmTitle: "هل تريد إيقاف مشاركة هذا المفتاح؟",
      stopSharingImpactBody: (companyNames: string) =>
        `هذه الشركات تستخدم هذا المفتاح المشترك حاليًا وستفقد الوصول إليه فورًا: ${companyNames}. يمكنها إضافة مفتاحها الخاص لاحقًا.`,
      stopSharingNoImpactBody: "لا توجد شركة أخرى تابعة لك تستخدم هذا المفتاح المشترك حاليًا.",
      stopSharingConfirmSubmit: "إيقاف المشاركة",
      stopSharingCancel: "إلغاء",
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
    socialPreview: {
      trigger: "معاينة",
      title: "معاينة على وسائل التواصل الاجتماعي",
      close: "إغلاق",
      disclaimer: "معاينة بصرية فقط — النشر الفعلي يتم فقط عبر الحسابات المتصلة.",
      tabInstagram: "إنستغرام",
      tabFacebook: "فيسبوك",
      tabLinkedin: "لينكدإن",
      tabTiktok: "تيك توك",
      cropWarning: "يقتصّ هذا التنسيق الصورة إلى إطار عمودي — أي جزء خارجه لن يظهر.",
      captionPlaceholder: "سيظهر نص التسمية التوضيحية هنا.",
      justNow: "الآن",
      originalAudio: "صوت أصلي",
      companyPage: "صفحة شركة",
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
