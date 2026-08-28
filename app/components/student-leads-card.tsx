import Link from "next/link";

export type StudentLeadRow = {
  agent_name: string | null;
  grade: string | null;
  nis: string;
  school_name: string | null;
  user_serial: string;
  user_name: string | null;
};

export function StudentLeadsCard({
  detailBaseHref,
  leads,
  previousAcademicYear,
  selectedAcademicYear,
}: {
  detailBaseHref: string;
  leads: StudentLeadRow[];
  previousAcademicYear: string | null;
  selectedAcademicYear: string;
}) {
  function detailHref(nis: string) {
    const [pathname, queryString = ""] = detailBaseHref.split("?");
    const params = new URLSearchParams(queryString);
    params.set("student", nis);
    params.set("fromLeads", "1");
    params.delete("history");
    return `${pathname}?${params.toString()}`;
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold">Leads Belum Renewal</h2>
        <p className="text-sm font-semibold text-slate-500">
          Siswa {previousAcademicYear ?? "-"} yang belum terdaftar di {selectedAcademicYear} pada seluruh branch.
        </p>
      </div>

      <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[680px] table-fixed border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
            <tr>
              <th className="w-[16%] px-3 py-2 font-bold">NIS</th>
              <th className="w-[25%] px-3 py-2 font-bold">Nama Siswa</th>
              <th className="w-[17%] px-3 py-2 font-bold">Jenjang Kelas</th>
              <th className="w-[27%] px-3 py-2 font-bold">Asal Sekolah</th>
              <th className="w-[15%] px-3 py-2 font-bold">Agent</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr className="border-t border-slate-200" key={lead.nis}>
                <td className="truncate px-3 py-2">
                  <Link className="font-medium text-[#2f6696] hover:underline" href={detailHref(lead.nis)}>
                    {lead.nis}
                  </Link>
                </td>
                <td className="truncate px-3 py-2 text-slate-600" title={lead.user_name ?? ""}>
                  {lead.user_name ?? "-"}
                </td>
                <td className="truncate px-3 py-2 text-slate-600" title={lead.grade ?? ""}>
                  {lead.grade ?? "-"}
                </td>
                <td className="truncate px-3 py-2 text-slate-600" title={lead.school_name ?? ""}>
                  {lead.school_name ?? "-"}
                </td>
                <td className="truncate px-3 py-2 text-slate-600" title={lead.agent_name ?? ""}>
                  {lead.agent_name ?? "-"}
                </td>
              </tr>
            ))}
            {!leads.length && (
              <tr>
                <td className="px-4 py-8 text-center font-semibold text-slate-500" colSpan={5}>
                  Tidak ada leads yang belum renewal.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-sm font-bold text-slate-500">
        {leads.length} leads belum renewal
      </div>
    </section>
  );
}
