import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <AppShell nombre={user.nombre} email={user.email} rol={user.rol}>
      {children}
    </AppShell>
  );
}
