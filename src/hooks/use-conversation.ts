"use client";

import useSWR from "swr";
import { endpoints, getConversation } from "@/lib/api";
import { POLL_MS } from "./use-paged";

/** Detalhe da conversa: handoff atual + as 20 tools mais recentes. */
export function useConversation(id: string) {
  return useSWR(endpoints.conversation(id), () => getConversation(id), {
    refreshInterval: POLL_MS,
  });
}
