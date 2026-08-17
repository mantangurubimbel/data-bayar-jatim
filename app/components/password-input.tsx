"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

export function PasswordInput({
  autoComplete,
  name,
}: {
  autoComplete: string;
  name: string;
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <span className="relative block">
      <input
        autoComplete={autoComplete}
        className="h-12 w-full rounded-md border border-slate-300 px-4 pr-12 text-base font-normal outline-none focus:border-[#2f6696]"
        name={name}
        required
        type={isVisible ? "text" : "password"}
      />
      <button
        aria-label={isVisible ? "Sembunyikan password" : "Tampilkan password"}
        className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        onClick={() => setIsVisible((current) => !current)}
        type="button"
      >
        {isVisible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}
