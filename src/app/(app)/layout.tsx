"use client";

import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { LoginScreen } from "@/components/login-screen";
import { useToken } from "@/lib/token";

// Portão de autenticação: sem token mostra o login; com token mostra o painel.
// `undefined` é só o instante da hidratação, antes de ler o localStorage.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const token = useToken();

  if (token === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!token) return <LoginScreen />;
  return <AppShell>{children}</AppShell>;
}
