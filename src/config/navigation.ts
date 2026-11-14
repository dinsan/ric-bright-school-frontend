import {
  Award,
  BookOpen,
  ChartLine,
  ClipboardList,
  FileText,
  GraduationCap,
  House,
  Library,
  MessageSquare,
  School,
  Shield,
  Repeat,
  Route,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { BadgeTone } from "@/components/ui/badge";

export type AppRole = "student" | "teacher" | "parent" | "admin";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** False until the page exists: such items are not shown, so nobody lands on a missing page. */
  ready?: boolean;
  /** Other paths that belong to this item (it is highlighted there too), e.g. sibling pages behind tabs. */
  match?: string[];
}

export interface RoleNavigation {
  /** Shown as a badge in the sidebar so people who switch roles know where they are. */
  label: string;
  tone: BadgeTone;
  items: NavItem[];
}

/**
 * Sidebar navigation per role. Items marked `ready: false` arrive with Phases 5–9; they stay listed
 * so the navigation has its final shape, but are hidden until their page exists. Keep each list
 * short (five or six items): students especially should never hunt for where to go.
 */
export const appNavigation: Record<AppRole, RoleNavigation> = {
  student: {
    label: "Student",
    tone: "accent",
    items: [
      { label: "Home", href: "/learn", icon: House },
      { label: "My courses", href: "/learn/courses", icon: BookOpen, match: ["/learn/notes"] },
      { label: "Learning path", href: "/learn/path", icon: Route },
      { label: "Assignments", href: "/learn/assignments", icon: ClipboardList },
      { label: "Review", href: "/learn/review", icon: Repeat },
      { label: "Achievements", href: "/learn/badges", icon: Award, match: ["/learn/certificates"] },
    ],
  },
  teacher: {
    label: "Teacher",
    tone: "middle",
    items: [
      { label: "Dashboard", href: "/teach", icon: House },
      { ready: false, label: "Classes", href: "/teach/classes", icon: Users },
      { ready: false, label: "Course studio", href: "/teach/studio", icon: Library },
      { ready: false, label: "Gradebook", href: "/teach/gradebook", icon: GraduationCap },
      { ready: false, label: "Question bank", href: "/teach/questions", icon: FileText },
    ],
  },
  parent: {
    label: "Parent",
    tone: "info",
    items: [
      { label: "Overview", href: "/family", icon: House },
      { label: "My children", href: "/family/children", icon: Users },
      { ready: false, label: "Messages", href: "/family/messages", icon: MessageSquare },
      { ready: false, label: "Reports", href: "/family/reports", icon: ChartLine },
    ],
  },
  admin: {
    label: "Admin",
    tone: "neutral",
    items: [
      { label: "Overview", href: "/admin", icon: House },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Course prices", href: "/admin/courses", icon: BookOpen },
      { ready: false, label: "Schools", href: "/admin/schools", icon: School },
      { ready: false, label: "Moderation", href: "/admin/moderation", icon: Shield },
      { ready: false, label: "Audit log", href: "/admin/audit-log", icon: FileText },
    ],
  },
};

/** The items to show: only pages that exist. */
export function visibleNavItems(role: AppRole): NavItem[] {
  return appNavigation[role].items.filter((item) => item.ready !== false);
}
