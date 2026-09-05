"use client";

import {
  ArrowLeftRightIcon,
  BeakerIcon,
  BoxesIcon,
  BookOpenIcon,
  ChartColumnIcon,
  ClipboardListIcon,
  FactoryIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ShapesIcon,
  TagIcon,
  TruckIcon,
  UserCogIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon };

const NAV: { seccion: string; items: Item[] }[] = [
  {
    seccion: "Operación",
    items: [
      { href: "/", label: "Inicio", icon: LayoutDashboardIcon },
      { href: "/movimientos", label: "Movimientos", icon: ArrowLeftRightIcon },
      { href: "/produccion", label: "Producción", icon: FactoryIcon },
      { href: "/stock", label: "Stock", icon: BoxesIcon },
      {
        href: "/consignaciones",
        label: "Consignaciones",
        icon: ClipboardListIcon,
      },
    ],
  },
  {
    seccion: "Registros",
    items: [
      { href: "/productos", label: "Productos", icon: PackageIcon },
      { href: "/insumos", label: "Insumos", icon: BeakerIcon },
      { href: "/precios", label: "Precios", icon: TagIcon },
      { href: "/clientes", label: "Clientes", icon: UsersIcon },
      { href: "/proveedores", label: "Proveedores", icon: TruckIcon },
    ],
  },
  {
    seccion: "Análisis",
    items: [
      { href: "/reportes", label: "Reportes", icon: ChartColumnIcon },
      { href: "/finanzas", label: "Finanzas", icon: BookOpenIcon },
    ],
  },
  {
    seccion: "Configuración",
    items: [
      { href: "/config/rubros", label: "Rubros", icon: ShapesIcon },
      { href: "/costos-fijos", label: "Costos fijos", icon: LandmarkIcon },
      { href: "/config/usuarios", label: "Usuarios", icon: UserCogIcon },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {NAV.map((grupo) => (
        <div key={grupo.seccion}>
          <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            {grupo.seccion}
          </p>
          <ul className="space-y-0.5">
            {grupo.items.map((it) => {
              const Icon = it.icon;
              const active = isActive(pathname, it.href);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-sidebar-primary font-medium text-sidebar-primary-foreground shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0",
                        !active && "text-muted-foreground",
                      )}
                    />
                    {it.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
