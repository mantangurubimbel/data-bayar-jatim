"use client";

import { KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { generateUserPassword } from "@/app/auth/actions";
import { buttonStyles } from "@/app/components/button-styles";

export function GeneratePasswordButton({ userId }: { userId: string }) {
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGeneratePassword() {
    setError(null);
    setPassword(null);

    startTransition(async () => {
      const result = await generateUserPassword(userId);

      if (result.error || !result.password) {
        setError(result.error ?? "Gagal generate password.");
        return;
      }

      setPassword(result.password);
    });
  }

  return (
    <div className="grid justify-items-end gap-2">
      <button
        className={buttonStyles.secondarySmall}
        disabled={isPending}
        onClick={handleGeneratePassword}
        type="button"
      >
        <KeyRound className="size-3.5" aria-hidden="true" />
        {isPending ? "Generate" : "Password"}
      </button>
      {password && (
        <code className="max-w-40 select-all rounded-md bg-slate-100 px-2 py-1 text-left text-xs font-bold text-slate-700">
          {password}
        </code>
      )}
      {error && <p className="max-w-40 text-right text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}
