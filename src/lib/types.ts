// Tipos espelhando o openapi.yaml do backend.

export type Author = "customer" | "agent" | "operator";
export type MessageStatus = "stored" | "queued" | "sent" | "failed";

export type LastMessage = {
  body: string;
  author: Author;
  createdAt: string;
};

export type Conversation = {
  id: string;
  phone: string;
  pushName: string | null;
  handoff: boolean;
  lastMessage: LastMessage | null;
  updatedAt: string;
};

export type ToolExecution = {
  id: string;
  messageId: string;
  name: string;
  arguments: Record<string, unknown>;
  result: unknown;
  status: "success" | "error";
  createdAt: string;
};

export type ConversationDetail = Conversation & {
  createdAt: string;
  recentToolExecutions: ToolExecution[];
};

export type Message = {
  id: string;
  direction: "inbound" | "outbound";
  author: Author;
  type: "text" | "audio" | "unsupported";
  body: string;
  status: MessageStatus;
  failureReason: string | null;
  createdAt: string;
};

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};

export type WhatsappStatus =
  | "unavailable"
  | "license_required"
  | "not_created"
  | "disconnected"
  | "connecting"
  | "connected";

export type WhatsappState = {
  status: WhatsappStatus;
  name: string | null;
  phone: string | null;
};
