import type {
  Conversation,
  ConversationDetail,
  Message,
  Page,
} from "./types";

// O navegador chama /api/backend/*; o route handler (app/api/backend/[...path]/route.ts)
// repassa para o backend e adiciona o token no servidor.
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
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        ...(init?.body !== undefined && { "Content-Type": "application/json" }),
      },
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "Não consegui falar com o backend. Ele está rodando?");
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as {
      error?: string;
    } | null;
    // 401 aqui = o backend recusou o BACKEND_API_TOKEN do servidor do frontend.
    throw new ApiError(
      res.status,
      res.status === 401
        ? "O backend recusou o token. Confira BACKEND_API_TOKEN no .env.local."
        : (data?.error ?? `Erro ${res.status}`),
    );
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
