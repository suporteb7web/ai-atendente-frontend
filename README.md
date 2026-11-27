# Atendente · Painel do operador

Frontend do projeto final do curso: um painel para acompanhar as conversas do **atendente de WhatsApp**, ver o que o agente de IA fez e **assumir o atendimento** (handoff) quando for preciso.

Ele consome a API do [`ai-atendente-backend`](../ai-atendente-backend) (contrato em `docs/frontend.md` e no `openapi.yaml` do backend).

![stack](https://img.shields.io/badge/Next.js-16-black) ![stack](https://img.shields.io/badge/shadcn%2Fui-base--nova-10b981) ![stack](https://img.shields.io/badge/Tailwind-4-38bdf8)

## O que dá para fazer

- **Lista de conversas** da mais recente para a mais antiga, com busca por nome/telefone, prévia da última mensagem e selo **Humano** quando o handoff está ligado.
- **Conversa aberta** com balões distintos para **cliente**, **agente** (IA) e **operador** (você), áudio transcrito, mensagens não suportadas, status de envio (`queued` → `sent` / `failed` com o motivo) e histórico paginado.
- **Handoff** por conversa com um interruptor: ligado, o agente para de responder e você responde pelo campo de texto; desligado, o agente volta.
- **Tools do agente**: painel "O que o agente fez" (argumentos e resultado) e chips nas mensagens que originaram cada tool.
- **Tempo quase real** por polling de 2 s, tema claro/escuro e layout responsivo (no celular é uma tela por vez).

## Rodando

Pré-requisitos: Node 20+ e o backend no ar em `http://localhost:3000` (`docker compose up` no repositório do backend).

```bash
npm install
cp .env.example .env.local   # BACKEND_URL=http://localhost:3000
npm run dev                  # http://localhost:3100
```

Abra `http://localhost:3100` e entre com o **`API_TOKEN` do backend** (no Compose local é `dev-token`).

| Script | O que faz |
| --- | --- |
| `npm run dev` | desenvolvimento em `:3100` (a `:3000` é do backend) |
| `npm run build && npm start` | build de produção em `:3100` |
| `npm run lint` | ESLint |

## Como funciona (roteiro para a aula)

```
src/
├─ app/
│  ├─ layout.tsx                       # fontes, tema, toasts
│  └─ (app)/
│     ├─ layout.tsx                    # portão: sem token → login, com token → painel
│     ├─ page.tsx                      # "selecione uma conversa"
│     └─ conversations/[id]/page.tsx   # uma conversa
├─ components/
│  ├─ login-screen.tsx  app-shell.tsx  conversation-list.tsx
│  └─ chat/ chat-view.tsx  message-bubble.tsx  composer.tsx  tools-panel.tsx
├─ hooks/                              # dados: use-paged, use-conversations, use-messages, use-conversation
└─ lib/                                # api.ts (fetch), token.ts, types.ts, format.ts
```

### 1. Proxy em vez de CORS
O backend não envia cabeçalhos de CORS (`CORS_ORIGIN` vazio). Em vez de alterá-lo, o `next.config.ts` faz um **rewrite**: o navegador chama `/api/backend/*` (mesma origem) e o Next repassa para `BACKEND_URL`. O header `Authorization` segue junto.

### 2. Token fora do código
Não há login de vários operadores: um token compartilhado abre o painel. Ele é digitado na tela de entrada, **validado numa rota protegida antes de ser guardado** e fica no `localStorage` (`lib/token.ts`, via `useSyncExternalStore`). Qualquer `401` apaga o token, mostra um aviso e volta ao login, o que também interrompe o polling.

### 3. Polling com SWR (`hooks/`)
A cada 2 s refazemos: a lista, a primeira página de mensagens e o detalhe da conversa (handoff + tools recentes). `usePaged` implementa o padrão do doc do backend:

- a **primeira página** é a que sofre polling;
- páginas **antigas** ("carregar anteriores") ficam em estado local e **nunca são descartadas**;
- tudo é unido pelo `id`, então um balão `queued` vira `sent`/`failed` sem mudar de lugar.

### 4. Enviar e handoff
- Enviar chama `POST /conversations/:id/messages` e mostra na hora o balão `queued` devolvido pelo `202`. **Nunca marcamos como enviado no clique**: só o polling traz `sent` ou `failed`.
- O interruptor chama `POST /conversations/:id/handoff`, atualiza a tela de forma otimista e o refetch confirma o estado real (inclusive quando o **agente** liga o handoff sozinho com `request_handoff`).

### 5. Tratamento de erros (tabela do doc)
`401` → login · `404` → sai da conversa · `400` → toast com a mensagem e o texto fica no campo · falha de rede → mensagem clara.

## Decisões de simplicidade

- Uma tela só (lista + conversa) e nenhuma tela que o backend não suporte (sem editar prompt/tools, sem mandar mídia).
- Sem estado global: SWR + um hook por recurso.
- Componentes do **shadcn/ui** (estilo `base-nova`, Base UI) e ícones **lucide**; o tema é só variáveis CSS em `globals.css`.
