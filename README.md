# Atendente · Painel do operador

Frontend do projeto final do curso: um painel para acompanhar as conversas do **atendente de WhatsApp**, ver o que o agente de IA fez e **assumir o atendimento** (handoff) quando for preciso.

Ele consome a API do [`ai-atendente-backend`](../ai-atendente-backend) (contrato em `docs/frontend.md` e no `openapi.yaml` do backend).

![stack](https://img.shields.io/badge/Next.js-16-black) ![stack](https://img.shields.io/badge/shadcn%2Fui-base--nova-10b981) ![stack](https://img.shields.io/badge/Tailwind-4-38bdf8)

## O que dá para fazer

- **Lista de conversas** da mais recente para a mais antiga, com busca por nome/telefone, prévia da última mensagem e selo **Humano** quando o handoff está ligado.
- **Conversa aberta** com balões distintos para **cliente**, **agente** (IA) e **operador** (você), áudio transcrito, mensagens não suportadas, status de envio (`queued` → `sent` / `failed` com o motivo) e histórico paginado.
- **Handoff** por conversa com um interruptor: ligado, o agente para de responder e você responde pelo campo de texto; desligado, o agente volta.
- **Tools do agente**: painel "O que o agente fez" (argumentos e resultado) e chips nas mensagens que originaram cada tool.
- **Conexão do WhatsApp** (`/whatsapp`): o projeto é single-tenant (um número), então não há cadastro nem login de usuários; há um passo a passo para ativar a licença do EvolutionGo, ler o **QR code**, ver o número conectado e desconectar. Um chip na lateral mostra se o número está no ar.
- **Tempo quase real** por polling de 2 s, tema claro/escuro e layout responsivo (no celular é uma tela por vez).

## Rodando

Pré-requisitos: Node 20+ e o backend no ar em `http://localhost:3000` (`docker compose up` no repositório do backend).

```bash
npm install
cp .env.example .env.local   # BACKEND_URL e BACKEND_API_TOKEN (os dois são obrigatórios)
npm run dev                  # http://localhost:3100
```

Abra `http://localhost:3100`: o painel abre direto, sem login. Na primeira vez, clique em **Conectar WhatsApp** e siga o passo a passo (veja abaixo). O `BACKEND_API_TOKEN` deve ser o `API_TOKEN` do backend (no Compose local é `dev-token`).

| Script | O que faz |
| --- | --- |
| `npm run dev` | desenvolvimento em `:3100` (a `:3000` é do backend) |
| `npm run build && npm start` | build de produção em `:3100` |
| `npm run lint` | ESLint |

## Conectando o WhatsApp (primeira vez)

1. **Licença do EvolutionGo** (uma vez só). O EvolutionGo só funciona com licença ativada. O painel abre o cadastro no site do provedor (gratuito) e, quando você volta, ativa a licença sozinho. Se o provedor mostrar um código em vez de redirecionar, cole-o em "Já tenho o código de ativação".
2. **Conectar**. O painel pede ao backend para criar a instância e gerar o QR code.
3. **Ler o QR** no WhatsApp: Configurações → Aparelhos conectados → Conectar um aparelho. A tela muda para "conectado" sozinha.

Para o agente **responder** de verdade, o backend também precisa de chaves reais da OpenAI e da ElevenLabs no `.env` dele (`OPENAI_API_KEY`, `ELEVENLABS_API_KEY`).

## Como funciona (roteiro para a aula)

```
src/
├─ app/
│  ├─ layout.tsx                       # fontes, tema, toasts
│  ├─ api/backend/[...path]/route.ts   # proxy para o backend (injeta o token no servidor)
│  └─ (app)/
│     ├─ layout.tsx                    # casca do painel
│     ├─ page.tsx                      # "selecione uma conversa"
│     ├─ whatsapp/page.tsx             # conexão do número (licença → QR → conectado)
│     └─ conversations/[id]/page.tsx   # uma conversa
├─ components/
│  ├─ app-shell.tsx  conversation-list.tsx  whatsapp-chip.tsx  whatsapp-connection.tsx  empty-state.tsx
│  └─ chat/ chat-view.tsx  message-bubble.tsx  composer.tsx  tools-panel.tsx
├─ hooks/                              # dados: use-paged, use-conversations, use-messages, use-conversation, use-whatsapp
└─ lib/                                # api.ts (fetch), types.ts, format.ts
```

### 1. Proxy no servidor: sem CORS e sem token no navegador
O backend não envia cabeçalhos de CORS (`CORS_ORIGIN` vazio) e exige `Authorization: Bearer`. Em vez de alterá-lo, o **route handler** `app/api/backend/[...path]/route.ts` recebe as chamadas do navegador em `/api/backend/*` (mesma origem), lê `BACKEND_API_TOKEN` do ambiente **no servidor**, adiciona o `Bearer` e repassa para `BACKEND_URL`. O token nunca é enviado ao navegador nem entra no código versionado.

> Como não há login, qualquer pessoa que alcance o frontend opera o painel. Para um deploy real, coloque autenticação na frente.

### 2. Erros de configuração são claros
Sem `BACKEND_API_TOKEN` o proxy responde `500` dizendo o que falta; token errado (`401` do backend) e backend fora do ar (`502`) também viram mensagens na tela.

### 3. Polling com SWR (`hooks/`)
A cada 2 s refazemos: a lista, a primeira página de mensagens e o detalhe da conversa (handoff + tools recentes). `usePaged` implementa o padrão do doc do backend:

- a **primeira página** é a que sofre polling;
- páginas **antigas** ("carregar anteriores") ficam em estado local e **nunca são descartadas**;
- tudo é unido pelo `id`, então um balão `queued` vira `sent`/`failed` sem mudar de lugar.

### 4. Enviar e handoff
- Enviar chama `POST /conversations/:id/messages` e mostra na hora o balão `queued` devolvido pelo `202`. **Nunca marcamos como enviado no clique**: só o polling traz `sent` ou `failed`.
- O interruptor chama `POST /conversations/:id/handoff`, atualiza a tela de forma otimista e o refetch confirma o estado real (inclusive quando o **agente** liga o handoff sozinho com `request_handoff`).

### 5. Tratamento de erros (tabela do doc)
`401` → mensagem pedindo para conferir o `BACKEND_API_TOKEN` · `404` → sai da conversa · `400` → toast com a mensagem e o texto fica no campo · falha de rede → mensagem clara.

## Decisões de simplicidade

- Uma tela só (lista + conversa) e nenhuma tela que o backend não suporte (sem editar prompt/tools, sem mandar mídia).
- Sem estado global: SWR + um hook por recurso.
- Componentes do **shadcn/ui** (estilo `base-nova`, Base UI) e ícones **lucide**; o tema é só variáveis CSS em `globals.css`.
