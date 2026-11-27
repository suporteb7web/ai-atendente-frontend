"use client";

import { useParams } from "next/navigation";
import { ChatView } from "@/components/chat/chat-view";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  // key={id}: ao trocar de conversa, todo o estado local (páginas antigas, scroll) recomeça.
  return <ChatView key={id} id={id} />;
}
