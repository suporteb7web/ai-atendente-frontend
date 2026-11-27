import { toast } from "sonner";
import { clearToken, getToken } from "./token";
import type {
  Conversation,
  ConversationDetail,
  Message,
  Page,
} from "./types";

// O navegador chama /api/backend/*; o Next repassa para o backend (next.config.ts).
const BASE = "/api/backend";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown; token?: string },
): Promise<T> {
  const token = init?.token ?? getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token ?? ""}`,
        ...(init?.body !== undefined && { "Content-Type": "application/json" }),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Não consegui falar com o backend. Ele está rodando?");
  }

  if (!res.ok) {
    // 401: token ausente/errado. Limpar o token volta para a tela de login e
    // para o polling.
    if (res.status === 401 && init?.token === undefined) {
      clearToken();
      toast.error("Token recusado pelo backend. Entre novamente.", { id: "unauthorized" });
    }
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new ApiError(res.status, data?.error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | null | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined) q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const endpoints = {
  conversations: (cursor?: string | null) =>
    `/conversations${qs({ limit: 30, cursor })}`,
  conversation: (id: string) => `/conversations/${id}`,
  messages: (id: string, cursor?: string | null) =>
    `/conversations/${id}/messages${qs({ limit: 50, cursor })}`,
};

export const listConversations = (cursor?: string | null) =>
  api<Page<Conversation>>(endpoints.conversations(cursor));

export const getConversation = (id: string) =>
  api<ConversationDetail>(endpoints.conversation(id));

export const listMessages = (id: string, cursor?: string | null) =>
  api<Page<Message>>(endpoints.messages(id, cursor));

export const sendOperatorMessage = (id: string, text: string) =>
  api<Message>(`/conversations/${id}/messages`, {
    method: "POST",
    body: { text },
  });

export const setHandoff = (id: string, enabled: boolean) =>
  api<{ id: string; handoff: boolean }>(`/conversations/${id}/handoff`, {
    method: "POST",
    body: { enabled },
  });

/** Testa um token numa rota protegida sem guardá-lo. Lança ApiError(401) se for recusado. */
export const checkToken = (token: string) =>
  api<Page<Conversation>>("/conversations?limit=1", { token });
