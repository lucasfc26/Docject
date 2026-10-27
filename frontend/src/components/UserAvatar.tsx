import { apiAssetUrl } from "../services/api";
import { cn } from "./ui";

export type CurrentProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  logoUrl?: string | null;
};

export const profileQueryKey = ["me"] as const;

export function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

/** Uploaded photo/logo, or the initial of the name when there is none. */
export function UserAvatar({ name, logoUrl, className }: { name?: string | null; logoUrl?: string | null; className?: string }) {
  if (logoUrl) {
    return (
      <img
        alt={name ?? "Logo"}
        className={cn("h-8 w-8 shrink-0 rounded-full border border-[color:var(--line)] bg-white object-cover", className)}
        src={apiAssetUrl(logoUrl)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--primary)] text-sm font-bold text-white dark:bg-[color:var(--warning)] dark:text-zinc-950",
        className,
      )}
    >
      {firstName(name).charAt(0).toUpperCase() || "?"}
    </span>
  );
}
