"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { signOut } from "@/app/auth/actions";

export function UserDropupMenu({ isAdmin, label }: { isAdmin: boolean; label: string }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeWhenOutside(event: MouseEvent) {
      const details = detailsRef.current;

      if (!details?.open || !(event.target instanceof Node)) {
        return;
      }

      if (!details.contains(event.target)) {
        details.open = false;
      }
    }

    document.addEventListener("mousedown", closeWhenOutside);
    return () => document.removeEventListener("mousedown", closeWhenOutside);
  }, []);

  return (
    <details
      ref={detailsRef}
      className="group relative rounded-full border border-slate-200 bg-white p-1.5 shadow-lg"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
        <span className="max-w-56 truncate px-2 text-xs font-bold text-slate-600">{label}</span>
        <span className="grid h-8 place-items-center rounded-full bg-slate-100 px-3 text-xs font-bold text-slate-700">
          Menu
        </span>
      </summary>
      <nav className="absolute bottom-full right-0 mb-2 hidden w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm font-bold text-slate-700 shadow-lg group-open:block">
        {isAdmin && (
          <Link className="block px-3 py-2 hover:bg-slate-100" href="/administrator">
            Administrator
          </Link>
        )}
        <Link className="block px-3 py-2 hover:bg-slate-100" href="/ubah-password">
          Ubah Password
        </Link>
        <form action={signOut}>
          <button className="block w-full cursor-pointer px-3 py-2 text-left hover:bg-slate-100">
            Logout
          </button>
        </form>
      </nav>
    </details>
  );
}
