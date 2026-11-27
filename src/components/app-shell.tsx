"use client";

import { usePathname } from "next/navigation";
import { ConversationList } from "@/components/conversation-list";
import { cn } from "@/lib/utils";

// Desktop: lista à esquerda + conversa à direita.
// Celular: uma coisa por vez (lista em "/", conversa em "/conversations/[id]").
export function AppShell({ children }: { children: React.ReactNode }) {
  const inConversation = usePathname() !== "/";
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <aside
        className={cn(
          "w-full shrink-0 flex-col border-r bg-card md:flex md:w-[360px]",
          inConversation ? "hidden" : "flex",
        )}
      >
        <ConversationList />
      </aside>
      <main className={cn("min-w-0 flex-1 md:flex", inConversation ? "flex" : "hidden")}>
        {children}
      </main>
    </div>
  );
}
