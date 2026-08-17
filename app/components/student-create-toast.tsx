"use client";

import { CheckCircle2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type StudentCreatePayload = {
  id?: number;
  entity_id?: string | null;
  actor_email?: string | null;
  after_data?: {
    branch_name?: string | null;
    grade?: string | null;
    user_name?: string | null;
  } | null;
  detail?: {
    academic_year?: string | null;
    user_name?: string | null;
  } | null;
};

type ToastState = {
  id: number;
  nis: string;
  branchName: string;
  grade: string;
  userName: string;
};

export function StudentCreateToast({
  currentUserId,
}: {
  currentUserId: string | null;
}) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    function showToast(nextLog: StudentCreatePayload) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      setToast({
        id: nextLog.id ?? Date.now(),
        nis: nextLog.entity_id ?? "",
        branchName: nextLog.after_data?.branch_name ?? "-",
        grade: nextLog.after_data?.grade ?? "-",
        userName: nextLog.after_data?.user_name ?? nextLog.detail?.user_name ?? "Siswa baru",
      });

      timerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 7000);
    }

    const channel = supabase
      .channel(`student-create-toast-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "t_admin_audit_log",
          filter: "entity_type=eq.student",
        },
        (payload) => {
          const nextLog = payload.new as StudentCreatePayload & { action?: string };

          if (nextLog.action !== "create") {
            return;
          }

          showToast(nextLog);
        },
      )
      .subscribe((status, error) => {
        if (error) {
          console.error("Student create toast subscription error:", error);
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Student create toast subscription status:", status);
        }
      });

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  if (!toast) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[min(360px,calc(100vw-2.5rem))] overflow-hidden rounded-md border border-emerald-200 bg-white shadow-xl">
      <div className="flex items-start gap-3 p-4">
        <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-slate-800">Siswa baru ditambahkan</p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-600">{toast.branchName}</p>
          <p className="mt-1 truncate text-xs font-semibold text-slate-500">
            {toast.userName} - {toast.grade}
          </p>
        </div>
        <button
          aria-label="Tutup notifikasi"
          className="grid size-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          onClick={() => setToast(null)}
          type="button"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
