import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]",
        variant === "primary" && "bg-[color:var(--primary)] text-white hover:opacity-90 dark:bg-[color:var(--warning)] dark:text-zinc-950",
        variant === "secondary" && "border border-[color:var(--line)] bg-[color:var(--panel)] text-[color:var(--text)] hover:bg-[color:var(--panel-strong)]",
        variant === "ghost" && "text-[color:var(--muted)] hover:bg-[color:var(--panel)] hover:text-[color:var(--text)]",
        className
      )}
      {...props}
    />
  );
}

type PanelProps = React.HTMLAttributes<HTMLDivElement>;

export function Panel({ className, ...props }: PanelProps) {
  return <section className={cn("glass-panel rounded-3xl", className)} {...props} />;
}

export function StatusBadge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "warning" | "danger" | "neutral" }) {
  const toneClass = {
    default: "border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 text-[color:var(--primary)] dark:text-[color:var(--accent)]",
    success: "border-mint-500/30 bg-mint-500/10 text-mint-600 dark:text-slate-300",
    warning: "border-ember-500/30 bg-ember-500/10 text-zinc-800 dark:text-ember-400",
    danger: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    neutral: "border-[color:var(--line)] bg-[color:var(--panel)] text-[color:var(--muted)]"
  }[tone];

  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", toneClass)}>{children}</span>;
}

export function MiniBarChart({ values }: { values: number[] }) {
  return (
    <div className="flex h-12 items-end gap-1.5">
      {values.map((value, index) => (
        <span
          className="w-3 rounded-t-full bg-[color:var(--accent)]/40 last:bg-[color:var(--primary)] dark:last:bg-[color:var(--warning)]"
          key={`${value}-${index}`}
          style={{ height: `${value}%` }}
        />
      ))}
    </div>
  );
}
