import { MessagesSquare } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="chat-bg flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-card shadow-sm">
        <MessagesSquare className="size-7 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">Selecione uma conversa</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        Escolha um cliente na lista para ver o histórico, o que o agente fez e, se precisar, assumir o atendimento.
      </p>
    </div>
  );
}
