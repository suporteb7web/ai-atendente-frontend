import { AppShell } from "@/components/app-shell";

// A autenticação com o backend acontece no servidor (ver app/api/backend/[...path]/route.ts),
// então o painel abre direto, sem tela de login.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
