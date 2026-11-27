"use client";

import { useCallback } from "react";
import { endpoints, listMessages } from "@/lib/api";
import type { Message } from "@/lib/types";
import { usePaged } from "./use-paged";

// Cronológico: a mais antiga em cima.
const byCreatedAsc = (a: Message, b: Message) =>
  a.createdAt.localeCompare(b.createdAt);

export function useMessages(conversationId: string) {
  const fetchPage = useCallback(
    (cursor: string | null) => listMessages(conversationId, cursor),
    [conversationId],
  );
  const paged = usePaged<Message>({
    key: endpoints.messages(conversationId),
    fetchPage,
    sort: byCreatedAsc,
  });

  /** Mostra na hora o balão `queued` devolvido pelo 202 do POST. */
  const addLocal = (message: Message) =>
    paged.mutateFirst(
      (page) =>
        page
          ? { ...page, items: [...page.items, message] }
          : { items: [message], nextCursor: null },
      { revalidate: false },
    );

  return { ...paged, addLocal };
}
