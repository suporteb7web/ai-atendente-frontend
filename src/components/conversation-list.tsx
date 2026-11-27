"use client";

import { Bot, LogOut, MessageCircleOff, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { ContactAvatar } from "@/components/contact-avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useConversations } from "@/hooks/use-conversations";
import { displayName, formatListDate, formatPhone } from "@/lib/format";
import { clearToken } from "@/lib/token";
import type { Conversation } from "@/lib/types";
import { cn } from "@/lib/utils";

const PREFIX = { customer: "", agent: "Agente: ", operator: "Você: " } as const;

export function ConversationList() {
  const { id: activeId } = useParams<{ id?: string }>();
  const { mutate } = useSWRConfig();
  const { items, isLoading, error, hasMore, loadMore, loadingMore } = useConversations();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) => (c.pushName ?? "").toLowerCase().includes(q) || c.phone.includes(q.replace(/\D/g, "") || "\0"),
    );
  }, [items, query]);

  function logout() {
    clearToken();
    mutate(() => true, undefined, { revalidate: false }); // limpa o cache do SWR
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Bot className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[15px] leading-tight font-semibold">Atendente</h1>
          <p className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "conversa" : "conversas"}
          </p>
        </div>
        <ThemeToggle />
        <Button variant="ghost" size="icon" aria-label="Sair" onClick={logout}>
          <LogOut className="size-4" />
        </Button>
      </header>

      <div className="border-b px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ListSkeleton />
        ) : error && items.length === 0 ? (
          <p className="p-6 text-center text-sm text-destructive">{error.message}</p>
        ) : filtered.length === 0 ? (
          <EmptyList searching={Boolean(query)} />
        ) : (
          <ul>
            {filtered.map((c) => (
              <li key={c.id}>
                <ConversationRow conversation={c} active={c.id === activeId} />
              </li>
            ))}
          </ul>
        )}

        {hasMore && !query && (
          <div className="p-3">
            <Button variant="outline" className="w-full" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Carregando..." : "Carregar conversas mais antigas"}
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function ConversationRow({ conversation: c, active }: { conversation: Conversation; active: boolean }) {
  const name = displayName(c);
  return (
    <Link
      href={`/conversations/${c.id}`}
      className={cn(
        "flex items-center gap-3 border-b border-border/50 px-4 py-3 transition-colors hover:bg-muted/60",
        active && "bg-primary/10 hover:bg-primary/10",
      )}
    >
      <ContactAvatar name={name} seed={c.phone} className="size-11" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatListDate(c.updatedAt)}</span>
        </div>
        {c.pushName && <p className="truncate text-xs text-muted-foreground">{formatPhone(c.phone)}</p>}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-sm text-muted-foreground">
            {c.lastMessage ? (
              <>
                <span className="text-foreground/60">{PREFIX[c.lastMessage.author]}</span>
                {c.lastMessage.body}
              </>
            ) : (
              <span className="italic">Sem mensagens</span>
            )}
          </p>
          {c.handoff && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              <UserRound className="size-3" />
              Humano
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
          <Skeleton className="size-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyList({ searching }: { searching: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
      <MessageCircleOff className="size-8" />
      <p className="text-sm font-medium text-foreground">
        {searching ? "Nada encontrado" : "Nenhuma conversa ainda"}
      </p>
      <p className="text-xs">
        {searching
          ? "Tente outro nome ou telefone."
          : "Quando um cliente mandar mensagem no WhatsApp, ela aparece aqui."}
      </p>
    </div>
  );
}
