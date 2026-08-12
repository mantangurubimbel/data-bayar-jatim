"use client";

import { useRouter } from "next/navigation";

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
  const isHeader = variant === "header";

  return (
    <label
      className={`grid gap-1 text-sm font-bold ${
        isHeader ? "text-blue-100" : "text-slate-500"
      }`}
    >
      {label}
      <select
        className={
          isHeader
            ? "h-8 min-w-64 rounded-md border border-white/25 bg-white/15 px-4 font-bold text-white outline-none"
            : "h-10 rounded-md border border-slate-200 bg-white px-4 font-bold text-slate-700 outline-none"
        }
        name={name}
        value={value}
        onChange={(event) => {
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
          router.push(`/?${params.toString()}`);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="text-slate-900">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
