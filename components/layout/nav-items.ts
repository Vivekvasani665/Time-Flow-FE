import { Activity, Cpu, FolderKanban, LayoutDashboard, ListChecks, Mail, MessagesSquare, ShieldCheck, Users, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; permission?: string; badge?: "chat-unread" };

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban, permission: "projects.view" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, permission: "tasks.view" },
  { href: "/chat", label: "Chat", icon: MessagesSquare, badge: "chat-unread" },
  { href: "/users", label: "Users", icon: Users, permission: "users.view" },
  { href: "/roles", label: "Roles", icon: ShieldCheck, permission: "roles.view" },
  { href: "/emails", label: "Mailbox", icon: Mail, permission: "emails.view" },
  { href: "/activity", label: "Activity log", icon: Activity, permission: "activity_logs.view" },
  { href: "/system", label: "System", icon: Cpu, permission: "queues.view" },
];
