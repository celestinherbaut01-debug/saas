"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function NavLink({ href, icon, children }: { href: string; icon: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium text-sidebar-ink-dim",
        active && "bg-sidebar-active text-white",
      )}
    >
      <span className="w-4 text-center text-[13px]">{icon}</span>
      {children}
    </Link>
  );
}
