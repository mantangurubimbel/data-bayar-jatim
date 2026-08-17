"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type Option = {
  label: string;
  value: string;
};

export function AutoSubmitSelect({
  label,
  name,
  value,
  options,
  variant = "default",
}: {
  label: string;
  name: string;
  value: string;
  options: Option[];
  variant?: "default" | "header";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const isHeader = variant === "header";
  const [pendingValue, setPendingValue] = useState<string | null>(null);
  const currentHref = useMemo(() => `${pathname}?${search}`, [pathname, search]);
  const isPending = pendingValue !== null && pendingValue !== value;

  useEffect(() => {
    if (!pendingValue) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPendingValue(null);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [pendingValue]);

  return (
    <label
      className={`grid gap-1 text-sm font-bold ${
        isHeader ? "text-blue-100" : "text-slate-500"
      }`}
    >
      <span className="flex items-center gap-2">
        {label}
        {isPending && <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />}
      </span>
      <div className="relative w-full">
        <select
          className={
            isHeader
              ? "h-8 min-w-64 rounded-md border border-white/25 bg-white/15 px-4 pr-9 font-bold text-white outline-none"
              : "h-10 w-full rounded-md border border-slate-200 bg-white px-4 pr-9 font-bold text-slate-700 outline-none"
          }
          disabled={isPending}
          name={name}
          value={value}
          onChange={(event) => {
            const nextValue = event.currentTarget.value;
            const form = event.currentTarget.form;
            if (!form) {
              return;
            }

            const params = new URLSearchParams();
            new FormData(form).forEach((fieldValue, fieldName) => {
              if (typeof fieldValue === "string" && fieldValue) {
                params.set(fieldName, fieldValue);
              }
            });
            params.set("page", "1");
            const nextHref = `/?${params.toString()}`;

            if (nextHref === currentHref || nextValue === value) {
              setPendingValue(null);
              return;
            }

            setPendingValue(nextValue);
            window.dispatchEvent(new Event("app:navigation-pending"));
            router.push(nextHref);
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="text-slate-900">
              {option.label}
            </option>
          ))}
        </select>
        {isPending && (
          <LoaderCircle
            className={`pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin ${
              isHeader ? "text-white" : "text-[#2f6696]"
            }`}
            aria-hidden="true"
          />
        )}
      </div>
    </label>
  );
}
