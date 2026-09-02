type BranchRelation = { branch_name: string | null } | { branch_name: string | null }[] | null;

export type ActiveAgentRow = {
  agent_id: number;
  agent_name: string;
  agent_email: string | null;
  branch_id: number | null;
  t_branch?: BranchRelation;
};

function firstRelation(value: BranchRelation | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function ActiveAgentsCard({ agents }: { agents: ActiveAgentRow[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-2xl font-bold">Daftar Agent Aktif</h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          {agents.length} agent aktif yang dapat diakses.
        </p>
      </div>

      <div className="mt-4 max-h-[420px] overflow-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] table-fixed border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600">
            <tr>
              <th className="w-[32%] px-3 py-2 font-bold">Nama</th>
              <th className="w-[33%] px-3 py-2 font-bold">Email</th>
              <th className="w-[35%] px-3 py-2 font-bold">Branch</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => {
              const branch = firstRelation(agent.t_branch);

              return (
                <tr className="border-t border-slate-200" key={agent.agent_id}>
                  <td className="truncate px-3 py-2 text-slate-700" title={agent.agent_name}>
                    {agent.agent_name}
                  </td>
                  <td className="truncate px-3 py-2 text-slate-600" title={agent.agent_email ?? ""}>
                    {agent.agent_email ?? "-"}
                  </td>
                  <td className="truncate px-3 py-2 text-slate-600" title={branch?.branch_name ?? ""}>
                    {branch?.branch_name ?? "-"}
                  </td>
                </tr>
              );
            })}
            {!agents.length && (
              <tr>
                <td className="px-4 py-8 text-center font-semibold text-slate-500" colSpan={3}>
                  Belum ada agent aktif.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
