import { AlertCircle, Bot, Check, Clock, ImageOff, Mic, Wrench } from "lucide-react";
import { formatTime } from "@/lib/format";
import type { Message, ToolExecution } from "@/lib/types";
import { cn } from "@/lib/utils";

// Três autores, três jeitos de desenhar:
//  customer -> esquerda, branco
//  agent    -> direita, verde claro (a IA)
//  operator -> direita, índigo sólido (o humano)
const STYLE = {
  customer: "bg-card border text-card-foreground rounded-tl-sm",
  agent: "bg-primary/15 border border-primary/25 rounded-tr-sm",
  operator: "bg-indigo-600 text-white rounded-tr-sm dark:bg-indigo-500",
} as const;

export function MessageBubble({ message: m, tools }: { message: Message; tools: ToolExecution[] }) {
  const outbound = m.author !== "customer";

  return (
    <div className={cn("flex flex-col gap-1", outbound ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 shadow-sm sm:max-w-[70%]",
          STYLE[m.author],
          m.status === "failed" && "border-destructive/50",
        )}
      >
        {m.author !== "customer" && (
          <p
            className={cn(
              "mb-0.5 flex items-center gap-1 text-[11px] font-semibold tracking-wide uppercase",
              m.author === "agent" ? "text-primary" : "text-white/80",
            )}
          >
            {m.author === "agent" ? <Bot className="size-3" /> : null}
            {m.author === "agent" ? "Agente" : "Você · operador"}
          </p>
        )}

        {m.type === "audio" && (
          <p className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Mic className="size-3" /> Áudio transcrito
          </p>
        )}

        {m.type === "unsupported" ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground italic">
            <ImageOff className="size-3.5" />
            {m.body}
          </p>
        ) : (
          <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">{m.body || "—"}</p>
        )}

        <div
          className={cn(
            "mt-1 flex items-center justify-end gap-1 text-[11px]",
            m.author === "operator" ? "text-white/70" : "text-muted-foreground",
          )}
        >
          <span>{formatTime(m.createdAt)}</span>
          {outbound && <StatusIcon status={m.status} onSolid={m.author === "operator"} />}
        </div>

      </div>

      {m.status === "failed" && (
        <p className="flex max-w-[85%] items-start gap-1 px-1 text-xs font-medium text-destructive sm:max-w-[70%]">
          <AlertCircle className="mt-0.5 size-3 shrink-0" />
          <span>
            {m.direction === "inbound" ? "Não consegui processar: " : "Falha no envio: "}
            {m.failureReason ?? "motivo não informado"}
          </span>
        </p>
      )}

      {/* Tools que o agente rodou neste turno ficam coladas na mensagem do cliente que as originou */}
      {tools.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {tools.map((t) => (
            <span
              key={t.id}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px]",
                t.status === "error"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-background text-muted-foreground",
              )}
            >
              <Wrench className="size-3" />
              {t.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status, onSolid }: { status: Message["status"]; onSolid: boolean }) {
  if (status === "queued") return <Clock className="size-3" aria-label="Na fila" />;
  if (status === "sent") return <Check className="size-3.5" aria-label="Enviada" />;
  if (status === "failed") return <AlertCircle className={cn("size-3.5", onSolid ? "text-red-200" : "text-destructive")} aria-label="Falhou" />;
  return null;
}
