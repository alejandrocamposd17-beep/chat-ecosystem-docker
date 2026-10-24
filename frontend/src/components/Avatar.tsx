import type { User } from "@/types/chat";

const STATUS_COLOR: Record<User["status"], string> = {
  online: "bg-emerald-500",
  away: "bg-amber-400",
  offline: "bg-neutral-400",
};

const STATUS_LABEL: Record<User["status"], string> = {
  online: "En linea",
  away: "Ausente",
  offline: "Desconectado",
};

export function statusLabel(status: User["status"]) {
  return STATUS_LABEL[status];
}

export default function Avatar({ user, size = 44 }: { user: User; size?: number }) {
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt={user.name}
          width={size}
          height={size}
          className="h-full w-full rounded-full bg-indigo-100 object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
          {initials}
        </div>
      )}
      <span
        title={STATUS_LABEL[user.status]}
        className={`absolute right-0 bottom-0 h-3 w-3 rounded-full ring-2 ring-white dark:ring-neutral-900 ${STATUS_COLOR[user.status]}`}
      />
    </div>
  );
}
