"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

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

  return (
    <Link
      href={href}
      prefetch
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-sidebar-ink-dim transition-colors",
        active
          ? "bg-sidebar-active text-white shadow-sm"
          : "hover:bg-white/[0.06] hover:text-white",
      )}
    >
      <span
        className={cn(
          "w-4 text-center text-[13px] transition-opacity",
          active ? "opacity-100" : "opacity-70 group-hover:opacity-100",
        )}
      >
        {icon}
      </span>
      <span className="flex-1">{children}</span>
      {badge && (
        <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold text-accent">{badge}</span>
      )}
    </Link>
  );
}
