import {
  Activity,
  AlertOctagon,
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle,
  ChevronRight,
  ClipboardCheck,
  Download,
  Dumbbell,
  Flame,
  Grab,
  HeartPulse,
  House,
  Info,
  Minus,
  Moon,
  Mountain,
  Plus,
  Shield,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Upload,
  User,
  Waves,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * The brand icon set. Lucide glyphs at a chunky stroke-width to match the
 * rounded type. Named (tree-shakeable) imports keyed by the kebab-case names the
 * design system uses, so components stay readable (`icon="flame"`).
 */
const ICONS = {
  activity: Activity,
  'alert-octagon': AlertOctagon,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  'calendar-check': CalendarCheck,
  check: Check,
  'check-circle': CheckCircle,
  'chevron-right': ChevronRight,
  'clipboard-check': ClipboardCheck,
  download: Download,
  dumbbell: Dumbbell,
  flame: Flame,
  grab: Grab,
  'heart-pulse': HeartPulse,
  house: House,
  info: Info,
  minus: Minus,
  moon: Moon,
  mountain: Mountain,
  plus: Plus,
  shield: Shield,
  sparkles: Sparkles,
  target: Target,
  timer: Timer,
  'trending-up': TrendingUp,
  'triangle-alert': TriangleAlert,
  trophy: Trophy,
  upload: Upload,
  user: User,
  waves: Waves,
  x: X,
  zap: Zap,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 20,
  strokeWidth = 2.25,
  className,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const Glyph = ICONS[name];
  return <Glyph size={size} strokeWidth={strokeWidth} className={className} aria-hidden />;
}
