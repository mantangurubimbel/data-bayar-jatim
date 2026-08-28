import Link from "next/link";
import { retrySheetSync } from "@/app/auth/actions";
import {
  type SheetSyncLogRow,
  type StudentAuditLogRow,
  isFullAdminRole,
  formatChangedFields,
  formatDateTime,
  requireAdminContext,
} from "@/app/administrator/admin-utils";
import { PageHeader } from "@/app/administrator/page-header";
import { buttonStyles } from "@/app/components/button-styles";
import { SubmitButton } from "@/app/components/submit-button";

const logsPageSize = 10;

export default async function AdminLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ auditPage?: string; error?: string; success?: string; syncPage?: string }>;
}) {
  const params = await searchParams;
  const { dataSupabase, profile } = await requireAdminContext();
  const isFullAdmin = isFullAdminRole(profile.role_id);
  const auditPage = Math.max(Number(params.auditPage ?? "1") || 1, 1);
  const syncPage = Math.max(Number(params.syncPage ?? "1") || 1, 1);
  const auditFrom = (auditPage - 1) * logsPageSize;
  const syncFrom = (syncPage - 1) * logsPageSize;
  const { data: actorBranches } = isFullAdmin
    ? { data: null }
    : await dataSupabase.from("t_app_user_branch").select("branch_id").eq("user_id", profile.id);
  const accessibleBranchIds = new Set((actorBranches ?? []).map((row) => row.branch_id));
  const accessibleBranchList = [...accessibleBranchIds];
  let auditQuery = dataSupabase
    .from("t_admin_audit_log")
    .select("id, entity_type, entity_id, action, branch_id, destination_branch_id, actor_email, detail, created_at", {
      count: "exact",
    });

  if (!isFullAdmin) {
    auditQuery = accessibleBranchList.length
      ? auditQuery.or(
          `branch_id.in.(${accessibleBranchList.join(",")}),destination_branch_id.in.(${accessibleBranchList.join(",")})`,
        )
      : auditQuery.eq("branch_id", -1);
  }

  const [{ data: auditLogs, count: auditCount }, { data: syncLogs, count: syncCount }] = await Promise.all([
    auditQuery
      .order("created_at", { ascending: false })
      .range(auditFrom, auditFrom + logsPageSize - 1),
    isFullAdmin
      ? dataSupabase
          .from("t_google_sheet_sync_log")
          .select("id, nis, action, status, actor_email, attempts, error_message, last_attempt_at", { count: "exact" })
          .order("last_attempt_at", { ascending: false })
          .range(syncFrom, syncFrom + logsPageSize - 1)
      : Promise.resolve({ data: [], count: 0 }),
  ]);
  const scopedAuditLogs = (auditLogs ?? []) as StudentAuditLogRow[];
  const syncLogRows = isFullAdmin ? ((syncLogs ?? []) as SheetSyncLogRow[]) : [];
  const totalAuditLogs = auditCount ?? 0;
  const totalAuditPages = Math.max(Math.ceil(totalAuditLogs / logsPageSize), 1);
  const auditFirstRow = totalAuditLogs === 0 ? 0 : auditFrom + 1;
  const auditLastRow = Math.min(auditFrom + scopedAuditLogs.length, totalAuditLogs);
  const totalSyncLogs = syncCount ?? 0;
  const totalSyncPages = Math.max(Math.ceil(totalSyncLogs / logsPageSize), 1);
  const syncFirstRow = totalSyncLogs === 0 ? 0 : syncFrom + 1;
  const syncLastRow = Math.min(syncFrom + syncLogRows.length, totalSyncLogs);

  return (
    <>
      <PageHeader description="Audit aktivitas siswa dan status sinkronisasi Google Sheet." title="Log" />
      {params.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {params.error}
        </div>
      )}
      {params.success === "sync-retry" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Retry sync Google Sheet sudah diproses.
        </div>
      )}

      <div className="grid gap-4">
        <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <h2 className="text-sm font-bold text-slate-700">Aktivitas Data Siswa</h2>
          </div>
          <div className="h-[360px] overflow-auto">
            <table className="w-full min-w-[680px] text-left text-sm font-normal text-slate-700">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Waktu</th>
                  <th className="px-4 py-3 font-bold">Aksi</th>
                  <th className="px-4 py-3 font-bold">Entitas</th>
                  <th className="px-4 py-3 font-bold">Branch</th>
                  <th className="px-4 py-3 font-bold">Perubahan</th>
                  <th className="px-4 py-3 font-bold">Operator</th>
                </tr>
              </thead>
              <tbody>
                {scopedAuditLogs.map((log) => (
                  <tr className="border-t border-slate-200" key={log.id}>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3 uppercase">{log.action}</td>
                    <td className="px-4 py-3">
                      {log.entity_type} {log.entity_id ? `#${log.entity_id}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      {log.branch_id ?? "-"}
                      {log.destination_branch_id ? ` -> ${log.destination_branch_id}` : ""}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3">
                      {formatChangedFields(log.detail?.changed_fields)}
                    </td>
                    <td className="px-4 py-3">{log.actor_email ?? "-"}</td>
                  </tr>
                ))}
                {!scopedAuditLogs.length && (
                  <tr>
                    <td className="px-4 py-8 text-center font-semibold text-slate-500" colSpan={6}>
                      Data belum tersedia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <LogPagination
            baseParams={params}
            currentPage={auditPage}
            firstRow={auditFirstRow}
            lastRow={auditLastRow}
            pageParam="auditPage"
            totalPages={totalAuditPages}
            totalRows={totalAuditLogs}
          />
        </section>

        <section className="overflow-hidden rounded-md border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-white px-4 py-3">
            <h2 className="text-sm font-bold text-slate-700">Status Sync Google Sheet</h2>
          </div>
          <div className="h-[360px] overflow-auto">
            <table className="w-full min-w-[720px] text-left text-sm font-normal text-slate-700">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-bold">Waktu</th>
                  <th className="px-4 py-3 font-bold">NIS</th>
                  <th className="px-4 py-3 font-bold">Aksi</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Pesan</th>
                  <th className="px-4 py-3 text-right font-bold">Retry</th>
                </tr>
              </thead>
              <tbody>
                {syncLogRows.map((log) => (
                  <tr className="border-t border-slate-200" key={log.id}>
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDateTime(log.last_attempt_at)}
                    </td>
                    <td className="px-4 py-3">{log.nis}</td>
                    <td className="px-4 py-3 uppercase">{log.action}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          log.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : log.status === "skipped"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-3" title={log.error_message ?? ""}>
                      {log.error_message ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.status === "failed" ? (
                        <form action={retrySheetSync}>
                          <input name="nis" type="hidden" value={log.nis} />
                          <input name="sync_action" type="hidden" value={log.action} />
                          <SubmitButton className={buttonStyles.primarySmall} pendingText="Retry">
                            Retry
                          </SubmitButton>
                        </form>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!syncLogRows.length && (
                  <tr>
                    <td className="px-4 py-8 text-center font-semibold text-slate-500" colSpan={6}>
                      Data belum tersedia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {isFullAdmin && (
            <LogPagination
              baseParams={params}
              currentPage={syncPage}
              firstRow={syncFirstRow}
              lastRow={syncLastRow}
              pageParam="syncPage"
              totalPages={totalSyncPages}
              totalRows={totalSyncLogs}
            />
          )}
        </section>
      </div>
    </>
  );
}

function LogPagination({
  baseParams,
  currentPage,
  firstRow,
  lastRow,
  pageParam,
  totalPages,
  totalRows,
}: {
  baseParams: { auditPage?: string; error?: string; success?: string; syncPage?: string };
  currentPage: number;
  firstRow: number;
  lastRow: number;
  pageParam: "auditPage" | "syncPage";
  totalPages: number;
  totalRows: number;
}) {
  function pageHref(page: number) {
    const nextParams = new URLSearchParams();
    Object.entries(baseParams).forEach(([key, value]) => {
      if (value) {
        nextParams.set(key, value);
      }
    });
    nextParams.set(pageParam, String(page));
    return `/administrator/logs?${nextParams.toString()}`;
  }

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Menampilkan {firstRow}-{lastRow} dari {totalRows} data
      </p>
      <div className="flex items-center gap-3">
        {currentPage > 1 ? (
          <Link className={buttonStyles.pager} href={pageHref(currentPage - 1)} scroll={false}>
            Prev
          </Link>
        ) : (
          <span className={buttonStyles.pagerDisabled}>Prev</span>
        )}
        <span>
          {currentPage} / {totalPages}
        </span>
        {currentPage < totalPages ? (
          <Link className={buttonStyles.pager} href={pageHref(currentPage + 1)} scroll={false}>
            Next
          </Link>
        ) : (
          <span className={buttonStyles.pagerDisabled}>Next</span>
        )}
      </div>
    </div>
  );
}
