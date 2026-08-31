import Link from "next/link";

import { logout } from "@/app/(auth)/login/actions";
import { Button } from "@/components/ui/button";

type NavItem = { href: string; label: string; ready?: boolean };

const NAV: { seccion: string; items: NavItem[] }[] = [
  {
    seccion: "Operación",
    items: [
      { href: "/", label: "Inicio", ready: true },
      { href: "/movimientos", label: "Movimientos" },
      { href: "/consignaciones", label: "Consignaciones" },
    ],
  },
  {
    seccion: "Registros",
    items: [
      { href: "/productos", label: "Productos" },
      { href: "/clientes", label: "Clientes" },
      { href: "/proveedores", label: "Proveedores" },
    ],
  },
  {
    seccion: "Finanzas",
    items: [
      { href: "/cc-clientes", label: "CC Clientes" },
      { href: "/cc-proveedores", label: "CC Proveedores" },
      { href: "/contabilidad", label: "Contabilidad" },
      { href: "/reportes", label: "Reportes" },
    ],
  },
  {
    seccion: "Configuración",
    items: [
      { href: "/config/usuarios", label: "Usuarios" },
      { href: "/config/rubros", label: "Rubros" },
    ],
  },
];

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-14 items-center gap-3 border-b bg-primary px-4 text-primary-foreground">
        <span className="font-semibold">Maitén</span>
        <span className="text-xs opacity-80">Sistema de gestión</span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden opacity-90 sm:inline">{email}</span>
          <form action={logout}>
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              className="h-8"
            >
              Salir
            </Button>
          </form>
        </div>
      </header>

      <div className="flex flex-1">
        <nav className="hidden w-56 shrink-0 border-r bg-sidebar p-3 md:block">
          {NAV.map((grupo) => (
            <div key={grupo.seccion} className="mb-4">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {grupo.seccion}
              </p>
              <ul className="space-y-0.5">
                {grupo.items.map((item) => (
                  <li key={item.href}>
                    {item.ready ? (
                      <Link
                        href={item.href}
                        className="block rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <span className="block cursor-not-allowed rounded-md px-2 py-1.5 text-sm text-muted-foreground/60">
                        {item.label}
                        <span className="ml-1 text-[10px]">pronto</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
