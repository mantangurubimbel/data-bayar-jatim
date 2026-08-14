"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function NavigationPendingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsPending(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, search]);

  useEffect(() => {
    function handlePendingNavigation() {
      setIsPending(true);
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest<HTMLAnchorElement>("a[href]");

      if (!link || link.target || link.hasAttribute("download")) {
        return;
      }

      const nextUrl = new URL(link.href, window.location.href);

      if (nextUrl.origin !== window.location.origin) {
        return;
      }

      const currentUrl = new URL(window.location.href);

      if (nextUrl.pathname === currentUrl.pathname && nextUrl.search === currentUrl.search) {
        return;
      }

      setIsPending(true);
    }

    window.addEventListener("app:navigation-pending", handlePendingNavigation);
    document.addEventListener("click", handleClick, true);
    return () => {
      window.removeEventListener("app:navigation-pending", handlePendingNavigation);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  if (!isPending) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[80] flex justify-center px-4">
      <div className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-lg">
        <LoaderCircle className="size-4 animate-spin text-[#2f6696]" aria-hidden="true" />
        Memuat
      </div>
    </div>
  );
}
