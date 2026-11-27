"use client";

import { Bot, KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import { ApiError, checkToken } from "@/lib/api";
import { setToken } from "@/lib/token";

export function LoginScreen() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = value.trim();
    if (!token) return;
    setLoading(true);
    setError(null);
    // Primeiro testa o token numa rota protegida; só guarda se o backend aceitar.
    // (Guardar antes trocaria esta tela pelo painel e perderíamos o erro.)
    try {
      await checkToken(token);
      setToken(token);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "Token inválido. Confira o API_TOKEN do backend."
          : err instanceof Error
            ? err.message
            : "Algo deu errado.",
      );
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4">
      {/* brilho decorativo */}
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Bot className="size-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Atendente</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Painel do operador. Acompanhe as conversas e assuma quando precisar.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm"
        >
          <div className="space-y-2">
            <label htmlFor="token" className="text-sm font-medium">
              Token de acesso
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="token"
                type="password"
                autoFocus
                autoComplete="off"
                placeholder="API_TOKEN do backend"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                aria-invalid={Boolean(error)}
                className="h-10 pl-8"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" size="lg" className="h-10 w-full" disabled={loading || !value.trim()}>
            {loading && <Loader2 className="animate-spin" />}
            Entrar
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          O token fica só neste navegador e é enviado como <code className="font-mono">Bearer</code> em cada chamada.
        </p>
      </div>
    </main>
  );
}
