"use client";

import { useCallback } from "react";
import { endpoints, listConversations } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { usePaged } from "./use-paged";

// Mais recente primeiro, desempate por id (mesma regra do backend).
const byUpdatedDesc = (a: Conversation, b: Conversation) =>
  b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

export function useConversations() {
  const fetchPage = useCallback((cursor: string | null) => listConversations(cursor), []);
  return usePaged<Conversation>({
    key: endpoints.conversations(),
    fetchPage,
    sort: byUpdatedDesc,
  });
}
