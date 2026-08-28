"use client";

import { KeyRound } from "lucide-react";
import { useState, useTransition } from "react";
import { generateUserPassword } from "@/app/auth/actions";
import { buttonStyles } from "@/app/components/button-styles";

export function GeneratePasswordButton({
  onGenerated,
  userId,
}: {
  onGenerated?: (password: string) => void;
  userId: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGeneratePassword() {
    setError(null);

    startTransition(async () => {
      const result = await generateUserPassword(userId);

      if (result.error || !result.password) {
        setError(result.error ?? "Gagal generate password.");
        return;
      }

      onGenerated?.(result.password);
      window.dispatchEvent(
        new CustomEvent("admin-user-password-generated", {
          detail: { password: result.password, userId },
        }),
      );
    });
  }

  return (
    <div className="grid justify-items-stretch gap-2">
      <button
        className={buttonStyles.formCompact}
        disabled={isPending}
        onClick={handleGeneratePassword}
        type="button"
      >
        <KeyRound className="size-3.5" aria-hidden="true" />
        {isPending ? "Generate" : "Password"}
      </button>
      {error && <p className="max-w-40 text-right text-xs font-bold text-red-600">{error}</p>}
    </div>
  );
}
