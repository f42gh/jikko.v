type StatCardProps = {
  label: string;
  value: string;
  note: string;
};

export function StatCard({ label, value, note }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-card backdrop-blur-xl">
      <p className="text-xs uppercase tracking-[0.25em] text-white/45">{label}</p>
      <p className="mt-3 font-display text-4xl text-accent">{value}</p>
      {note && <p className="mt-2 text-sm leading-6 text-white/55">{note}</p>}
    </div>
  );
}
