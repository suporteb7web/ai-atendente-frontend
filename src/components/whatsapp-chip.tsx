"use client";

import { ChevronRight, QrCode, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useWhatsapp } from "@/hooks/use-whatsapp";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

// Faixa na lateral: mostra se o número está no ar e leva para a tela de conexão.
export function WhatsappChip() {
  const { data } = useWhatsapp();
  if (!data) return null;

  const connected = data.status === "connected";
  const down = data.status === "unavailable";

  return (
    <Link
      href="/whatsapp"
      className={cn(
        "flex items-center gap-2.5 border-b px-4 py-2 text-sm transition-colors",
        connected && "hover:bg-muted/60",
        !connected && !down && "bg-amber-500/10 text-amber-800 hover:bg-amber-500/15 dark:text-amber-200",
        down && "bg-destructive/10 text-destructive hover:bg-destructive/15",
      )}
    >
      {connected ? (
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
      ) : down ? (
        <TriangleAlert className="size-4" />
      ) : (
        <QrCode className="size-4" />
      )}
      <span className="min-w-0 flex-1 truncate">
        {connected
          ? `WhatsApp conectado${data.phone ? ` · ${formatPhone(data.phone)}` : data.name ? ` · ${data.name}` : ""}`
          : down
            ? "EvolutionGo fora do ar"
            : "WhatsApp desconectado · conectar"}
      </span>
      <ChevronRight className="size-4 shrink-0 opacity-60" />
    </Link>
  );
}
