"use client";

import { MessagesSquare, QrCode } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWhatsapp } from "@/hooks/use-whatsapp";

// Tela inicial: se o número ainda não está conectado, o primeiro passo é conectá-lo.
export function EmptyState() {
  const { data } = useWhatsapp();
  const needsConnection = data && data.status !== "connected";

  return (
    <div className="chat-bg flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-card shadow-sm">
        {needsConnection ? <QrCode className="size-7 text-primary" /> : <MessagesSquare className="size-7 text-primary" />}
      </div>
      {needsConnection ? (
        <>
          <h2 className="text-lg font-semibold">Conecte o WhatsApp para começar</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            O atendente só recebe e responde mensagens depois que o número for conectado.
          </p>
          <Button size="lg" className="mt-1 h-10" nativeButton={false} render={<Link href="/whatsapp" />}>
            <QrCode /> Conectar WhatsApp
          </Button>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Selecione uma conversa</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Escolha um cliente na lista para ver o histórico, o que o agente fez e, se precisar, assumir o atendimento.
          </p>
        </>
      )}
    </div>
  );
}
