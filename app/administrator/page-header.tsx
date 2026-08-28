export function PageHeader({ description, title }: { description: string; title: string }) {
  return (
    <header className="rounded-md border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f6696]">Administrator</p>
      <h1 className="mt-1 text-[24px] font-bold tracking-tight text-slate-950">{title}</h1>
      <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
    </header>
  );
}
