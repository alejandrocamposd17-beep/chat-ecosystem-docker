"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Mode = "login" | "register";

export default function AuthForm({ mode, expired = false }: { mode: Mode; expired?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(expired ? "Tu sesión expiró. Vuelve a iniciar sesión." : null);
  const [form, setForm] = useState({ name: "", email: "", password: "", password_confirmation: "" });

  const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  function submit(values: typeof form | null) {
    setErrors({});
    setMessage(null);
    startTransition(async () => {
      // values null: entrar como invitado (cuenta temporal, sin registro)
      const url = values === null ? "/api/session/guest" : mode === "login" ? "/api/session" : "/api/session/register";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(values ?? {}),
      });

      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (res.status === 422 && data?.errors) {
        const flat: Record<string, string> = {};
        for (const [field, list] of Object.entries(data.errors as Record<string, string[]>)) {
          flat[field] = list[0];
        }
        setErrors(flat);
      } else {
        setMessage(res.status === 429 ? "Demasiados intentos. Espera un minuto." : (data?.message ?? "No se pudo conectar."));
      }
    });
  }

  const isLogin = mode === "login";

  return (
    <div className="flex min-h-dvh items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-3xl" aria-hidden>
          💬
        </p>
        <h1 className="mt-2 text-xl font-semibold">{isLogin ? "Inicia sesión" : "Crea tu cuenta"}</h1>
        <p className="mt-1 text-sm text-neutral-500">Chat en tiempo real con Next.js, Laravel y Docker.</p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(form);
          }}
        >
          {!isLogin && (
            <Field label="Nombre" error={errors.name}>
              <input value={form.name} onChange={update("name")} required maxLength={80} autoComplete="name" className={inputClass} />
            </Field>
          )}
          <Field label="Correo" error={errors.email}>
            <input type="email" value={form.email} onChange={update("email")} required autoComplete="email" className={inputClass} />
          </Field>
          <Field label="Contraseña" error={errors.password}>
            <input
              type="password"
              value={form.password}
              onChange={update("password")}
              required
              minLength={isLogin ? undefined : 8}
              autoComplete={isLogin ? "current-password" : "new-password"}
              className={inputClass}
            />
          </Field>
          {!isLogin && (
            <Field label="Confirmar contraseña" error={errors.password_confirmation}>
              <input
                type="password"
                value={form.password_confirmation}
                onChange={update("password_confirmation")}
                required
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
          )}

          {message && (
            <p role="alert" className="text-sm text-red-600">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-indigo-600 py-2.5 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {pending ? "Un momento..." : isLogin ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <div className="mt-5 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300">
          <p className="font-medium">¿Solo quieres probarlo?</p>
          <p className="mt-1">Entra sin registrarte con una cuenta de invitado temporal (dura 24 horas). Puedes cambiarle el nombre en tu perfil.</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => submit(null)}
            className="mt-2 w-full rounded-lg border border-indigo-300 bg-white py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60 dark:border-indigo-700 dark:bg-neutral-900 dark:text-indigo-300 dark:hover:bg-neutral-800"
          >
            Probar sin registrarme
          </button>
        </div>

        <p className="mt-5 text-center text-sm text-neutral-500">
          {isLogin ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <Link href={isLogin ? "/register" : "/login"} className="font-medium text-indigo-600 hover:underline">
            {isLogin ? "Regístrate" : "Inicia sesión"}
          </Link>
        </p>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-neutral-700 dark:bg-neutral-900";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
