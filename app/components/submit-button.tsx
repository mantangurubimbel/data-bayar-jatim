"use client";

import { LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className,
  disabled = false,
  form,
  pendingText,
}: {
  children: ReactNode;
  className: string;
  disabled?: boolean;
  form?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      className={className}
      disabled={disabled || pending}
      form={form}
      type="submit"
    >
      {pending && <LoaderCircle className="mr-2 size-4 animate-spin" aria-hidden="true" />}
      {pending ? (pendingText ?? children) : children}
    </button>
  );
}
