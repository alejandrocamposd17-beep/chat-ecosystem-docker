import type { User } from "@/types/chat";
import { avatarSrc } from "@/lib/files";

const STATUS_COLOR: Record<User["status"], string> = {
  online: "bg-emerald-500",
  away: "bg-amber-400",
  offline: "bg-neutral-400",
};

const STATUS_LABEL: Record<User["status"], string> = {
  online: "En línea",
  away: "Ausente",
  offline: "Desconectado",
};

const TIME_ZONE = "America/El_Salvador";

/** "En línea" o "Visto por última vez hoy a las 10:30" */
export function statusLabel(status: User["status"], lastSeenAt?: string | null) {
  if (status !== "offline" || !lastSeenAt) return STATUS_LABEL[status];

  const seen = new Date(lastSeenAt);
  const time = new Intl.DateTimeFormat("es-SV", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE }).format(seen);
  const day = new Intl.DateTimeFormat("es-SV", { day: "2-digit", month: "short", timeZone: TIME_ZONE }).format(seen);
  const today = new Intl.DateTimeFormat("es-SV", { day: "2-digit", month: "short", timeZone: TIME_ZONE }).format(new Date());
  return `Visto por última vez ${day === today ? "hoy" : `el ${day}`} a las ${time}`;
}

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({ user, size = 44, showStatus = true }: { user: User; size?: number; showStatus?: boolean }) {
  const src = avatarSrc(user);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={user.name} width={size} height={size} className="h-full w-full rounded-full bg-indigo-100 object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
          {initials(user.name)}
        </div>
      )}
      {showStatus && (
        <span
          title={STATUS_LABEL[user.status]}
          className={`absolute right-0 bottom-0 h-3 w-3 rounded-full ring-2 ring-white dark:ring-neutral-900 ${STATUS_COLOR[user.status]}`}
        />
      )}
    </div>
  );
}

/** Avatar de un grupo: iniciales del nombre sobre fondo de color */
export function GroupAvatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {initials(name) || "G"}
    </div>
  );
}
