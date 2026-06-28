export function StatCard({
  title,
  value,
  border,
  icon,
}: {
  title: string;
  value: string | number;
  border: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border ${border} bg-card/80 p-5 shadow-[0_0_30px_rgba(0,0,0,0.22)]`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>

        <div className="text-red-400">{icon}</div>
      </div>

      <h2 className="mt-4 text-3xl font-bold text-white">{value}</h2>
    </div>
  );
}
