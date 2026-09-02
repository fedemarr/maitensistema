"use client";

import { MenuIcon } from "lucide-react";
import { useState } from "react";

import { logout } from "@/app/(auth)/login/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { Rol } from "@/lib/auth";

import { SideNav } from "./side-nav";

const ROL_LABEL: Record<Rol, string> = {
  admin: "Admin",
  ventas: "Ventas",
  lectura: "Solo lectura",
};

export function AppShell({
  nombre,
  email,
  rol,
  children,
}: {
  nombre: string;
  email: string;
  rol: Rol;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon-sm" className="md:hidden" />
            }
          >
            <MenuIcon className="size-4" />
            <span className="sr-only">Abrir menú</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-sidebar p-0">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle className="text-left">
                <span className="font-semibold text-primary">Maitén</span>
              </SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto">
              <SideNav onNavigate={() => setOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold text-primary">Maitén</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            Sistema de gestión
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2.5 text-sm">
          <span
            className="hidden text-muted-foreground md:inline"
            title={email}
          >
            {nombre}
          </span>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {ROL_LABEL[rol]}
          </Badge>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r bg-sidebar md:block">
          <SideNav />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
