"use client";

import Link from "next/link";
import { useActionState } from "react";

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

import { solicitarReset, type RecuperarState } from "./actions";

export default function RecuperarPage() {
  const [state, formAction, pending] = useActionState<RecuperarState, FormData>(
    solicitarReset,
    { status: "idle" },
  );

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Recuperar contraseña</CardTitle>
          <CardDescription>
            Te mandamos un enlace por email para elegir una nueva.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.status === "sent" ? (
            <p className="text-sm text-muted-foreground">
              Si el email está registrado, vas a recibir el enlace en unos
              minutos. Revisá también el spam.
            </p>
          ) : (
            <form action={formAction} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              {state.status === "error" ? (
                <p className="text-sm text-destructive">{state.error}</p>
              ) : null}
              <Button type="submit" disabled={pending} className="w-full">
                {pending ? "Enviando…" : "Enviar enlace"}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm">
            <Link href="/login" className="text-primary hover:underline">
              Volver a ingresar
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
