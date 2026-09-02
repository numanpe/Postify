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
