"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, Label } from "@/components/ui";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const raw = useSearchParams().get("callbackUrl");
  // Solo rutas internas, para evitar open redirects
  const callbackUrl = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/superadmin";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Correo o contraseña incorrectos.");
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <main className="app-surface flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-slate-900">Acceso administrador</h1>
        <p className="mt-1 text-sm text-slate-500">
          Esta cuenta es solo para administrar la plataforma. Si eres cliente, tu sitio se edita con el enlace que
          recibiste al crearlo — no necesitas cuenta.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando…" : "Entrar"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          ¿Quieres crear un sitio?{" "}
          <Link href="/onboarding" className="font-medium text-brand-blue hover:underline">
            Empieza aquí, sin cuenta
          </Link>
        </p>
      </Card>
    </main>
  );
}
