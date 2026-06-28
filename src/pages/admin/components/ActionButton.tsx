export function ActionButton({
  children,
  onClick,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "bg-red-600/90 text-white hover:bg-red-500"
          : "border border-white/10 bg-white/8 text-white hover:bg-white/14"
      }`}
    >
      {children}
    </button>
  );
}
