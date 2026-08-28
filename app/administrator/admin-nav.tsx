"use client";

import Link from "next/link";
import { Activity, Building2, LayoutDashboard, Settings, ShieldCheck, UserRoundCog, Users } from "lucide-react";
import { usePathname } from "next/navigation";

const menuItems = [
  { href: "/administrator", label: "Overview", icon: LayoutDashboard },
  { href: "/administrator/operations", label: "Operasional", icon: Building2 },
  { href: "/administrator/agents", label: "Agent", icon: UserRoundCog },
  { href: "/administrator/logs", label: "Log", icon: Activity },
  { href: "/administrator/users", label: "User", icon: Users },
  { href: "/administrator/access", label: "Akses Terbatas", icon: ShieldCheck },
  { href: "/administrator/settings", label: "Pengaturan", icon: Settings },
];

export function AdminNav({ isFullAdmin }: { isFullAdmin: boolean }) {
  const pathname = usePathname();
  const visibleMenuItems = isFullAdmin
    ? menuItems
    : menuItems.filter((item) => item.href !== "/administrator/settings");

  return (
    <>
      <p className="px-3 pb-2 pt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
        Management
      </p>
      {visibleMenuItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 ${
              isActive ? "bg-[#2b2b2b] text-white ring-1 ring-white/5" : "hover:bg-white/10"
            }`}
            href={item.href}
            key={item.href}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
