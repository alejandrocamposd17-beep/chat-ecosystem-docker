"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { User } from "@/types/chat";
import { changePassword, removeAvatar, updateProfile, uploadAvatar } from "@/lib/client-api";
import Avatar from "./Avatar";

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-neutral-700 dark:bg-neutral-900";

/** Perfil: nombre, foto y contraseña. */
export default function ProfileForm({ me: initial }: { me: User }) {
  const router = useRouter();
  const [me, setMe] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ type: "ok", text: await action() });
      router.refresh(); // actualiza el nombre y la foto en la barra lateral
    } catch (e) {
      setNotice({ type: "error", text: e instanceof Error ? e.message : "No se pudo guardar" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex-1 overflow-y-auto bg-neutral-50 p-4 md:p-8 dark:bg-neutral-950">
      <div className="mx-auto max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="rounded-lg px-2 py-1 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800" aria-label="Volver">
            ←
          </Link>
          <h1 className="text-xl font-semibold">Mi perfil</h1>
        </div>

        {notice && (
          <p role="status" className={`rounded-lg px-3 py-2 text-sm ${notice.type === "ok" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"}`}>
            {notice.text}
          </p>
        )}

        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="font-semibold">Foto y nombre</h2>
          <div className="flex items-center gap-4">
            <Avatar user={me} size={72} showStatus={false} />
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInput}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                className="hidden"
                aria-label="Subir foto de perfil"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  run(async () => {
                    setMe(await uploadAvatar(file));
                    return "Foto actualizada.";
                  });
                  e.target.value = "";
                }}
              />
              <button disabled={busy} onClick={() => fileInput.current?.click()} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                Cambiar foto
              </button>
              {me.avatarVersion && (
                <button
                  disabled={busy}
                  onClick={() => run(async () => {
                    setMe(await removeAvatar());
                    return "Foto eliminada.";
                  })}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                >
                  Quitar
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-500">JPG, PNG o WebP de hasta 2 MB.</p>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                setMe(await updateProfile(name.trim()));
                return "Nombre actualizado.";
              });
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Nombre" className={inputClass} />
            <button disabled={busy || name.trim().length < 2 || name.trim() === me.name} className="rounded-xl bg-indigo-600 px-4 text-sm text-white disabled:opacity-50">
              Guardar
            </button>
          </form>
        </div>

        {me.isGuest ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <h2 className="font-semibold">Cuenta de invitado</h2>
            <p className="mt-1">Es temporal: dura 24 horas y no tiene contraseña. Para conservar tus chats, crea una cuenta.</p>
          </div>
        ) : (
        <form
          className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const res = await changePassword(passwords.current, passwords.next, passwords.confirm);
              setPasswords({ current: "", next: "", confirm: "" });
              return res.message;
            });
          }}
        >
          <h2 className="font-semibold">Cambiar contraseña</h2>
          <input type="password" autoComplete="current-password" placeholder="Contraseña actual" aria-label="Contraseña actual" value={passwords.current} onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))} required className={inputClass} />
          <input type="password" autoComplete="new-password" placeholder="Nueva contraseña (mín. 8, letras y números)" aria-label="Nueva contraseña" minLength={8} value={passwords.next} onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))} required className={inputClass} />
          <input type="password" autoComplete="new-password" placeholder="Confirmar nueva contraseña" aria-label="Confirmar nueva contraseña" value={passwords.confirm} onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))} required className={inputClass} />
          <button disabled={busy} className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            Cambiar contraseña
          </button>
          <p className="text-xs text-neutral-500">Al cambiarla se cierran tus sesiones en otros dispositivos.</p>
        </form>
        )}
      </div>
    </section>
  );
}
