'use client';

import {
  Building2,
  ChartColumnBig,
  CircleAlert,
  CreditCard,
  FileText,
  Home,
  ListChecks,
  Megaphone,
  MessageCircle,
  Settings,
  Shield,
  Sparkles,
  Users,
  Vote,
  Wrench,
} from 'lucide-react';
import type { NavigationIconKey } from '@/lib/navigation-config';

export const NAVIGATION_ICON_MAP: Record<NavigationIconKey, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  home: Home,
  building2: Building2,
  fileText: FileText,
  creditCard: CreditCard,
  users: Users,
  messageCircle: MessageCircle,
  circleAlert: CircleAlert,
  megaphone: Megaphone,
  vote: Vote,
  wrench: Wrench,
  settings: Settings,
  sparkles: Sparkles,
  chartColumnBig: ChartColumnBig,
  listChecks: ListChecks,
};
