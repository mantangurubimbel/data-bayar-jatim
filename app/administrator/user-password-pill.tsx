"use client";

import { useEffect, useState } from "react";

type PasswordGeneratedEvent = CustomEvent<{ password: string; userId: string }>;
const hiddenPassword = "****************";

export function UserPasswordPill({ userId }: { userId: string }) {
  const [password, setPassword] = useState<string | null>(null);

  useEffect(() => {
    function handlePasswordGenerated(event: Event) {
      const detail = (event as PasswordGeneratedEvent).detail;

      if (detail.userId !== userId) {
        return;
      }

      setPassword(detail.password);
    }

    window.addEventListener("admin-user-password-generated", handlePasswordGenerated);
    return () => window.removeEventListener("admin-user-password-generated", handlePasswordGenerated);
  }, [userId]);

  return (
    <span
      className="inline-flex min-w-[180px] items-center justify-center rounded-full bg-[#e8f1f8] px-2.5 py-1 text-center font-mono text-xs font-bold text-[#2f6696]"
      title={password ?? "Password belum digenerate"}
    >
      {password ?? hiddenPassword}
    </span>
  );
}
