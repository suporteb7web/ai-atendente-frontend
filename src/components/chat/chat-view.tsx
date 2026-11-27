"use client";

import { ArrowLeft, Bot, Loader2, Wrench, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Composer } from "@/components/chat/composer";
import { MessageBubble } from "@/components/chat/message-bubble";
import { ToolsPanel } from "@/components/chat/tools-panel";
import { ContactAvatar } from "@/components/contact-avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useConversation } from "@/hooks/use-conversation";
import { useMessages } from "@/hooks/use-messages";
import { ApiError, endpoints, setHandoff } from "@/lib/api";
import { dayKey, displayName, formatDayLabel, formatPhone } from "@/lib/format";
import type { ConversationDetail, ToolExecution } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ChatView({ id }: { id: string }) {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: detail, error: detailError, mutate: mutateDetail } = useConversation(id);
  const messages = useMessages(id);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [togglingHandoff, setTogglingHandoff] = useState(false);

  // 404: a conversa não existe (mais) -> tira da tela.
  useEffect(() => {
    if (detailError instanceof ApiError && detailError.status === 404) {
      toast.error("Conversa não encontrada.");
      router.replace("/");
    }
  }, [detailError, router]);

  // ---- handoff -----------------------------------------------------------
  async function toggleHandoff(enabled: boolean) {
    if (!detail) return;
    setTogglingHandoff(true);
    // Otimista só na tela; o backend é a fonte da verdade e o polling confirma.
    mutateDetail({ ...detail, handoff: enabled }, { revalidate: false });
    try {
      await setHandoff(id, enabled);
      toast.success(enabled ? "Você assumiu a conversa. O agente está pausado." : "O agente voltou a responder.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      await mutateDetail();
      globalMutate(endpoints.conversations()); // atualiza o selo "Humano" na lista
      setTogglingHandoff(false);
    }
  }

  // ---- ferramentas ancoradas na mensagem do cliente ------------------------
  const toolsByMessage = useMemo(() => {
    const map = new Map<string, ToolExecution[]>();
    for (const t of [...(detail?.recentToolExecutions ?? [])].reverse()) {
      map.set(t.messageId, [...(map.get(t.messageId) ?? []), t]);
    }
    return map;
  }, [detail]);

  // ---- scroll ------------------------------------------------------------
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true); // true = usuário está colado no fim, acompanha mensagens novas
  const prevHeight = useRef<number | null>(null); // para manter a posição ao carregar mensagens antigas
  const items = messages.items;
  const lastId = items.at(-1)?.id;
  const firstId = items[0]?.id;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current !== null) {
      el.scrollTop += el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
    } else if (stick.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lastId, firstId, items.length]);

  // Se o conteúdo crescer sem mensagem nova (ex.: balão virou "failed" e ganhou
  // a linha do motivo), continua colado no fim quando o usuário já estava lá.
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner) return;
    const ro = new ResizeObserver(() => {
      if (stick.current && prevHeight.current === null) el.scrollTop = el.scrollHeight;
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const loadOlder = useCallback(() => {
    prevHeight.current = scroller.current?.scrollHeight ?? null;
    messages.loadMore();
  }, [messages]);

  const name = detail ? displayName(detail) : "";

  return (
    <div className="flex min-w-0 flex-1">
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Cabeçalho */}
        <header className="flex items-center gap-3 border-b bg-card px-3 py-2.5 sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Voltar"
            nativeButton={false}
            render={<Link href="/" />}
          >
            <ArrowLeft className="size-4" />
          </Button>
          {detail ? (
            <>
              <ContactAvatar name={name} seed={detail.phone} />
              <div className="min-w-0 flex-1">
                <h2 className="truncate leading-tight font-semibold">{name}</h2>
                <p className="truncate text-xs text-muted-foreground">{formatPhone(detail.phone)}</p>
              </div>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-full border bg-background py-1.5 pr-3 pl-3 text-sm">
                <span className="hidden items-center gap-1.5 sm:flex">
                  {detail.handoff ? (
                    <UserRound className="size-4 text-amber-600 dark:text-amber-300" />
                  ) : (
                    <Bot className="size-4 text-primary" />
                  )}
                  <span className="font-medium">{detail.handoff ? "Atendimento humano" : "Agente ativo"}</span>
                </span>
                <span className="font-medium sm:hidden">{detail.handoff ? "Humano" : "Agente"}</span>
                <Switch
                  checked={detail.handoff}
                  onCheckedChange={toggleHandoff}
                  disabled={togglingHandoff}
                  aria-label="Assumir a conversa (handoff)"
                />
              </label>
            </>
          ) : (
            <HeaderSkeleton />
          )}
          <Button
            variant="outline"
            size="icon"
            aria-label="Ver tools executadas"
            className="xl:hidden"
            onClick={() => setToolsOpen(true)}
          >
            <Wrench className="size-4" />
          </Button>
        </header>

        {/* Faixa de handoff */}
        {detail?.handoff && (
          <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
            <UserRound className="size-4 shrink-0" />
            <span>
              <strong>Handoff ligado.</strong> O agente não responde esta conversa. Você responde pelo campo abaixo;
              desligue o interruptor para devolver ao agente.
            </span>
          </div>
        )}

        {/* Mensagens */}
        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          }}
          className="chat-bg flex-1 overflow-y-auto px-3 py-4 sm:px-6"
        >
          <div ref={content} className="mx-auto flex max-w-3xl flex-col gap-2">
            {messages.hasMore && (
              <div className="mb-2 flex justify-center">
                <Button variant="secondary" size="sm" onClick={loadOlder} disabled={messages.loadingMore}>
                  {messages.loadingMore && <Loader2 className="animate-spin" />}
                  Carregar mensagens anteriores
                </Button>
              </div>
            )}

            {messages.isLoading && <MessagesSkeleton />}

            {messages.error && items.length === 0 && (
              <p className="py-8 text-center text-sm text-destructive">{messages.error.message}</p>
            )}

            {!messages.isLoading && !messages.error && items.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
            )}

            {items.map((m, i) => (
              <Fragment key={m.id}>
                {(i === 0 || dayKey(items[i - 1].createdAt) !== dayKey(m.createdAt)) && (
                  <div className="my-2 flex justify-center">
                    <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm capitalize">
                      {formatDayLabel(m.createdAt)}
                    </span>
                  </div>
                )}
                <MessageBubble message={m} tools={toolsByMessage.get(m.id) ?? []} />
              </Fragment>
            ))}
          </div>
        </div>

        <Composer
          conversationId={id}
          handoff={Boolean(detail?.handoff)}
          onSent={(message) => {
            stick.current = true;
            messages.addLocal(message);
            globalMutate(endpoints.conversations()); // sobe a conversa na lista
          }}
        />
      </section>

      {/* Painel de tools: fixo em telas largas, gaveta nas demais */}
      <aside className="hidden w-[340px] shrink-0 flex-col border-l bg-card xl:flex">
        <ToolsHeader />
        <div className="flex-1 overflow-y-auto">
          <ToolsBody detail={detail} />
        </div>
      </aside>
      <Sheet open={toolsOpen} onOpenChange={setToolsOpen}>
        <SheetContent side="right" className="w-[92vw] gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="border-b">
            <SheetTitle>O que o agente fez</SheetTitle>
            <SheetDescription>Tools executadas nesta conversa.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <ToolsBody detail={detail} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ToolsHeader() {
  return (
    <div className="border-b px-4 py-3">
      <h3 className="font-semibold">O que o agente fez</h3>
      <p className="text-xs text-muted-foreground">Tools executadas nesta conversa</p>
    </div>
  );
}

function ToolsBody({ detail }: { detail?: ConversationDetail }) {
  if (!detail) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  return <ToolsPanel tools={detail.recentToolExecutions} />;
}

function HeaderSkeleton() {
  return (
    <>
      <Skeleton className="size-10 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </>
  );
}

function MessagesSkeleton() {
  return (
    <div className="space-y-3">
      {[
        "w-48 self-start",
        "w-64 self-end",
        "w-40 self-start",
      ].map((c, i) => (
        <Skeleton key={i} className={cn("h-12 rounded-2xl", c)} />
      ))}
    </div>
  );
}
