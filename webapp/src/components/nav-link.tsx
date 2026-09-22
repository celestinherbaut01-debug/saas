"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSidebarCollapsed } from "@/components/sidebar-collapse-context";

export function NavLink({
  href,
  icon,
  badge,
  children,
}: {
  href: string;
  icon: string;
  badge?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  const collapsed = useSidebarCollapsed();
  const label = typeof children === "string" ? children : undefined;

  return (
    <Link
      href={href}
      prefetch
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-lg text-[13px] font-medium text-sidebar-ink-dim transition-colors",
        collapsed ? "h-10 w-10 justify-center px-0" : "px-3 py-2.5",
        active
          ? "bg-sidebar-active text-white shadow-[var(--shadow-sm)]"
          : "hover:bg-white/[0.06] hover:text-white",
      )}
    >
      {active && (
        <span
          aria-hidden
          className="absolute inset-y-1 left-0 w-[3px] rounded-full"
          style={{ background: "var(--gradient-signature)" }}
        />
      )}
      <span
        className={cn(
          "w-4 text-center text-[13px] transition-opacity",
          active ? "bg-[image:var(--gradient-signature)] bg-clip-text text-transparent opacity-100" : "opacity-70 group-hover:opacity-100",
        )}
      >
        {icon}
      </span>
      {!collapsed && <span className="flex-1">{children}</span>}
      {!collapsed && badge && (
        <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold text-accent">{badge}</span>
      )}
    </Link>
  );
}
