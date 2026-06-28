export function Info({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${
        wide ? "md:col-span-2" : ""
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>

      <div className="mt-1 break-all text-sm font-semibold text-white">
        {value}
      </div>
    </div>
  );
}
