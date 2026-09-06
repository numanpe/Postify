// One shared icon per real action/concept, imported everywhere that
// concept appears — the point (per CLAUDE.md's non-technical-UX
// principle) is that "Regenerate" always looks the same icon no matter
// which page it's on, not a per-page choice. None of these are
// directional (arrows, back/forward chevrons) so none need an RTL
// mirror — a camera/gear/send icon means the same thing read
// right-to-left or left-to-right. If a genuinely directional icon is
// ever added here, it needs a `rtl:-scale-x-100` (or equivalent) at the
// call site — see AppNav's hamburger/close icons for the one pair in
// this app that's already handled that way structurally (X is
// symmetric, so no mirroring was actually needed there either).
import {
  Sparkles,
  Image as ImageIcon,
  Video,
  CalendarDays,
  Recycle,
  Send,
  FolderOpen,
  Palette,
  Settings,
  LogOut,
  Download,
  RefreshCw,
  RotateCcw,
  Trash2,
  Check,
  Key,
  Scissors,
  Upload,
  Zap,
  Heart,
  MessageCircle,
  Bookmark,
  Share2,
  ThumbsUp,
  Repeat2,
  Music2,
  Eye,
  Building2,
  HelpCircle,
  Inbox,
  Wand2,
  TrendingUp,
  ImagePlus,
  X,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Plus,
  FileText,
  Clapperboard,
  type LucideIcon,
} from "lucide-react";

export const NavIcons = {
  studio: Sparkles,
  poster: ImageIcon,
  video: Video,
  campaigns: CalendarDays,
  repurpose: Recycle,
  publish: Send,
  media: FolderOpen,
  brandKit: Palette,
  settings: Settings,
  signOut: LogOut,
  addCompany: Building2,
  help: HelpCircle,
  inbox: Inbox,
  growth: TrendingUp,
} satisfies Record<string, LucideIcon>;

export const ActionIcons = {
  download: Download,
  regenerate: RefreshCw,
  retry: RotateCcw,
  remove: Trash2,
  approve: Check,
  apiKey: Key,
  editVideo: Scissors,
  publishDirect: Upload,
  publishProvider: Send,
  generate: Zap,
  share: Share2,
  edit: Wand2,
  // Distinct from `generate` (Zap, the plain "make this" action) — the
  // wand specifically means "AI interprets/creates," reused verbatim
  // from `edit`'s own meaning (poster's "Edit with AI") for the same
  // real concept, just under a clearer name for a fresh-generation
  // context rather than an edit-in-place one.
  aiGenerate: Wand2,
  uploadMedia: ImagePlus,
  // Video editor visual redesign (2026-09-07) — replaces literal
  // unicode glyphs (×, ⠿, ▲/▼, +) that had crept into
  // scene-thumbnail-strip.tsx with this app's own real icon system, the
  // same "one shared icon per concept" rule this file's own top comment
  // already states. dismiss and remove are deliberately different
  // glyphs for different real actions: dismiss (X) is the small corner
  // badge on a scene thumbnail ("take this one out of the list, right
  // here"); remove (Trash2, already defined above) is the explicit
  // "Remove this section" text action in the script editor — same
  // real distinction most design systems draw between an inline
  // dismiss and a deliberate delete.
  dismiss: X,
  dragHandle: GripVertical,
  moveUp: ChevronUp,
  moveDown: ChevronDown,
  add: Plus,
  trim: Scissors,
} satisfies Record<string, LucideIcon>;

export const SectionIcons = {
  script: FileText,
  scenes: Clapperboard,
} satisfies Record<string, LucideIcon>;

// lucide-react no longer ships per-brand logo marks (Instagram/
// Facebook/Linkedin were removed over trademark concerns) — the social
// previewer (SocialMediaPreviewer) uses these generic engagement icons
// for its mockup chrome instead, styled per-platform via color/layout
// rather than a brand glyph.
export const SocialPreviewIcons = {
  like: Heart,
  thumbsUp: ThumbsUp,
  comment: MessageCircle,
  share: Share2,
  repost: Repeat2,
  save: Bookmark,
  send: Send,
  sound: Music2,
  views: Eye,
} satisfies Record<string, LucideIcon>;
