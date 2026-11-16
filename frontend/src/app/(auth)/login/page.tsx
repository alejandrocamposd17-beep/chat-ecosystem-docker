import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

async function LoginForm({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return <AuthForm mode="login" expired={expired === "1"} />;
}

export default function LoginPage({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  return (
    <Suspense fallback={<AuthForm mode="login" />}>
      <LoginForm searchParams={searchParams} />
    </Suspense>
  );
}
