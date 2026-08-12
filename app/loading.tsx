import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f6fb] px-6 text-slate-900">
      <div className="grid justify-items-center gap-3 rounded-lg border border-slate-200 bg-white px-8 py-7 shadow-sm">
        <LoaderCircle className="size-8 animate-spin text-[#2f6696]" aria-hidden="true" />
        <p className="text-sm font-bold text-slate-600">Memuat halaman</p>
      </div>
    </main>
  );
}
