type StatCardProps = {
  label: string;
  value: string;
  note: string;
};

export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-5 shadow-card">
      <p className="text-xs uppercase tracking-[0.25em] text-black/45">{label}</p>
      <p className="mt-3 font-display text-4xl">{value}</p>
      <p className="mt-2 text-sm leading-6 text-black/60">{note}</p>
    </div>
  );
}
