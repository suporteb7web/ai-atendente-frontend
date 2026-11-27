import { CheckCircle2, Wrench, XCircle } from "lucide-react";
import { formatDayLabel, formatTime } from "@/lib/format";
import type { ToolExecution } from "@/lib/types";
import { cn } from "@/lib/utils";

// Painel "O que o agente fez": as 20 execuções mais novas que vêm no detalhe da conversa.
export function ToolsPanel({ tools }: { tools: ToolExecution[] }) {
  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
        <Wrench className="size-8" />
        <p className="text-sm font-medium text-foreground">Nenhuma tool executada</p>
        <p className="text-xs">Quando o agente usar uma ferramenta (como pedir um humano), ela aparece aqui.</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3 p-4">
      {tools.map((t) => (
        <li key={t.id} className="rounded-xl border bg-card p-3 text-sm shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-mono text-[13px] font-semibold">
              <Wrench className="size-3.5 text-muted-foreground" />
              {t.name}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                t.status === "success" ? "text-primary" : "text-destructive",
              )}
            >
              {t.status === "success" ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
              {t.status === "success" ? "sucesso" : "erro"}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatDayLabel(t.createdAt)} às {formatTime(t.createdAt)}
          </p>
          <Json label="Argumentos" value={t.arguments} />
          <Json label="Resultado" value={t.result} error={t.status === "error"} />
        </li>
      ))}
    </ul>
  );
}

function Json({ label, value, error }: { label: string; value: unknown; error?: boolean }) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <pre
        className={cn(
          "max-h-40 overflow-auto rounded-lg bg-muted px-2.5 py-2 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap",
          error && "text-destructive",
        )}
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
