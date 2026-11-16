import { Suspense } from "react";
import { unstable_rethrow } from "next/navigation";
import ApiError from "@/components/ApiError";
import ProfileForm from "@/components/ProfileForm";
import { getMe } from "@/lib/server-api";

async function ProfileLoader() {
  const result = await getMe().then(
    (me) => ({ ok: true as const, me }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );

  if (!result.ok) return <ApiError error={result.error} />;
  return <ProfileForm me={result.me} />;
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-neutral-500">Cargando perfil...</div>}>
      <ProfileLoader />
    </Suspense>
  );
}
