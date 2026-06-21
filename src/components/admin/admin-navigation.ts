import {
  BookText,
  BrainCircuit,
  DatabaseBackup,
  Eraser,
  FolderTree,
  History,
  LayoutDashboard,
  ListTodo,
  Rss,
  ScrollText,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

export interface AdminNavigationGroup {
  label: string;
  items: AdminNavigationItem[];
}

export const ADMIN_NAVIGATION_GROUPS: AdminNavigationGroup[] = [
  {
    label: "概览",
    items: [{ name: "系统概览", href: "/admin", icon: LayoutDashboard }],
  },
  {
    label: "内容运营",
    items: [
      { name: "文章管理", href: "/admin/articles", icon: BookText },
      { name: "来源管理", href: "/admin/sources", icon: FolderTree },
      { name: "微信集成", href: "/admin/integrations/wechat-rss", icon: Rss },
    ],
  },
  {
    label: "自动化与 AI",
    items: [
      { name: "异步任务", href: "/admin/tasks", icon: ListTodo },
      { name: "同步记录", href: "/admin/sync-records", icon: History },
      { name: "AI 配置", href: "/admin/settings/ai", icon: BrainCircuit },
    ],
  },
  {
    label: "用户与权限",
    items: [
      { name: "用户管理", href: "/admin/users", icon: Users },
      { name: "邀请码管理", href: "/admin/invitations", icon: Ticket },
    ],
  },
  {
    label: "系统维护",
    items: [
      { name: "系统日志", href: "/admin/logs", icon: ScrollText },
      { name: "数据备份", href: "/admin/backup", icon: DatabaseBackup },
      { name: "数据清洗", href: "/admin/clean", icon: Eraser },
    ],
  },
];

export function isAdminNavigationItemActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findActiveAdminNavigationItem(pathname: string) {
  return ADMIN_NAVIGATION_GROUPS.flatMap((group) => group.items).find((item) =>
    isAdminNavigationItemActive(pathname, item.href)
  );
}
