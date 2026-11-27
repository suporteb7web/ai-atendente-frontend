"use client";

import { Loader2, SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendOperatorMessage } from "@/lib/api";
import type { Message } from "@/lib/types";

const MAX = 4000; // limite do backend (depois do trim)

export function Composer({
  conversationId,
  handoff,
  onSent,
}: {
  conversationId: string;
  handoff: boolean;
  onSent: (message: Message) => void;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  const trimmed = text.trim();
  const tooLong = trimmed.length > MAX;
  const canSend = trimmed.length > 0 && !tooLong && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      // 202: o backend grava como `queued` e envia no worker. O balão só vira
      // "enviado" quando o polling trouxer `sent`; nunca marcamos no clique.
      const message = await sendOperatorMessage(conversationId, trimmed);
      onSent(message);
      setText("");
    } catch (e) {
      toast.error((e as Error).message); // 400: mostre o erro e não reenvie igual
    } finally {
      setSending(false);
      ref.current?.focus();
    }
  }

  return (
    <div className="border-t bg-card p-3">
      <div className="flex items-end gap-2">
        <Textarea
          ref={ref}
          value={text}
          rows={1}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={handoff ? "Responda como operador..." : "Mensagem como operador..."}
          className="max-h-40 min-h-10 resize-none py-2.5"
          aria-label="Mensagem do operador"
        />
        <Button size="icon-lg" className="size-10 shrink-0 rounded-full" onClick={send} disabled={!canSend} aria-label="Enviar">
          {sending ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </div>
      <div className="mt-1.5 flex justify-between px-1 text-[11px] text-muted-foreground">
        <span>
          {handoff ? "Enter envia · Shift+Enter quebra linha" : "O agente também está ativo nesta conversa"}
        </span>
        {trimmed.length > MAX - 500 && (
          <span className={tooLong ? "font-medium text-destructive" : ""}>
            {trimmed.length}/{MAX}
          </span>
        )}
      </div>
    </div>
  );
}
