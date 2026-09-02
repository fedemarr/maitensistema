"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { nuevaClaveInput } from "@/features/usuarios/schema";

export default function ActualizarClavePage() {
  const router = useRouter();
  const supabase = createClient();
  const [tieneSesion, setTieneSesion] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [repetir, setRepetir] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setTieneSesion(Boolean(data.user)));
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = nuevaClaveInput.safeParse({ password, repetir });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setOk(true);
    setTimeout(() => router.push("/"), 1200);
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Nueva contraseña</CardTitle>
          <CardDescription>Elegí una contraseña para tu cuenta.</CardDescription>
        </CardHeader>
        <CardContent>
          {tieneSesion === false ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                El enlace venció o no es válido. Pedí uno nuevo.
              </p>
              <Link
                href="/recuperar"
                className="text-primary hover:underline"
              >
                Recuperar contraseña
              </Link>
            </div>
          ) : ok ? (
            <p className="text-sm text-muted-foreground">
              Contraseña actualizada. Entrando…
            </p>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repetir">Repetir</Label>
                <Input
                  id="repetir"
                  type="password"
                  autoComplete="new-password"
                  value={repetir}
                  onChange={(e) => setRepetir(e.target.value)}
                  required
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <Button
                type="submit"
                disabled={saving || tieneSesion === null}
                className="w-full"
              >
                {saving ? "Guardando…" : "Guardar contraseña"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
