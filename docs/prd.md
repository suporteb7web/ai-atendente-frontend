# PRD — Backend do atendente de WhatsApp

Documento de implementação. O leitor é um agente que vai construir este backend. As decisões abaixo já estão fechadas: implemente como está escrito. Quando um comportamento não aparecer aqui, escolha o caminho mais curto que preserve estes fluxos e registre a escolha no código, sem ampliar o produto.

Fonte das decisões: `docs/brain-dump.md`.

## O que este backend faz

Um número de WhatsApp, conectado por uma instância do EvolutionGo, atende várias conversas ao mesmo tempo. Cada telefone de cliente é uma conversa.

Quando chega uma mensagem:

1. O webhook responde na hora e enfileira o evento.
2. O worker grava a mensagem no Postgres.
3. Áudio é transcrito pela API da ElevenLabs e o texto da transcrição passa a ser o conteúdo da mensagem.
4. Se a conversa está em handoff, o fluxo para. O operador lê e responde pelo frontend.
5. Se a conversa está com o agente, o Google ADK lê o histórico, o system prompt, o playbook e as tools, chama a OpenAI no modelo `gpt-6-luna` e produz uma resposta.
6. A resposta entra na fila de outbound e o adapter do EvolutionGo envia o texto.

O frontend não faz parte deste repositório. Este backend expõe a API que ele consome.

## Fora deste PRD

Não implementar: multi-tenancy, várias instâncias, disparo ativo, cadastro de conversa pelo operador, tela ou endpoint para editar prompt ou tools, envio de áudio/imagem/documento, grupos, status do WhatsApp, leitura de recibo, botões, citação estruturada, login de vários operadores, papéis, e a UI do ADK (`adk web`) em produção.

## Stack

- Node.js na versão mínima exigida por `@google/adk`, usando 22 ou superior quando essa versão já satisfizer o pacote
- TypeScript, ESM (`"type": "module"`)
- Express
- PostgreSQL + DrizzleORM + drizzle-kit
- Redis + BullMQ
- Google ADK (`@google/adk`) como runtime do agente, com a OpenAI no modelo `gpt-6-luna`
- ElevenLabs Speech to Text, modelo `scribe_v4_turbo`
- Vitest e Supertest
- Docker Compose sobe `api`, `postgres` e `redis`
- Pino para log. Log leva id de conversa e id de mensagem. Não logar corpo de mensagem, transcrição, áudio nem segredo

## Forma do código

```
src/
  server.ts                 # sobe http e workers
  app.ts                    # express, rotas, error handler
  config.ts                 # env validado na subida; processo sai se faltar variável
  db/
    client.ts
    schema.ts
    migrate.ts
  modules/
    webhook/                # controller + parser do envelope Evolution
    conversations/          # leitura para o operador
    messages/               # gravação e leitura
    handoff/
    pipeline/               # orquestra o job inbound
  adapters/
    evolution/              # MessagingPort
    elevenlabs/             # TranscriptionPort
    agent/                  # AgentPort em cima do ADK
      openai-llm.ts         # BaseLlm que chama a OpenAI, se o ADK não exportar um conector oficial
  queues/
    inbound.ts
    outbound.ts
  tools/
    registry.ts             # tools de negócio + request_handoff
    request-handoff.ts
    current-time.ts         # tool de exemplo para provar o registro
  prompt/
    system.md
    playbook.md
openapi.yaml
docker-compose.yml
drizzle.config.ts
```

Controllers recebem HTTP e chamam services. Services não importam Express. Integrações externas existem só atrás de port:

- `MessagingPort.sendText(phone, text) -> providerMessageId`
- `TranscriptionPort.transcribe(audio, mimeType) -> text`
- `AgentPort.run(input) -> { text, toolCalls, handoffRequested }`

Testes de unidade usam fakes desses ports. O adapter do Evolution é o único lugar que conhece URL, header `apikey` e o formato do EvolutionGo. Trocar por WhatsApp oficial ou Kapso no futuro significa um novo adapter do mesmo port.

## Ambiente

Obrigatórias:

| Variável | Uso |
|---|---|
| `DATABASE_URL` | Postgres |
| `REDIS_URL` | BullMQ |
| `API_TOKEN` | valor comparado ao `Authorization: Bearer` |
| `EVOLUTION_BASE_URL` | base da instância, sem barra final |
| `EVOLUTION_API_KEY` | header `apikey` em `POST /send/text` |
| `EVOLUTION_WEBHOOK_TOKEN` | comparado ao `instanceToken` do corpo do webhook |
| `ELEVENLABS_API_KEY` | header `xi-api-key` |
| `OPENAI_API_KEY` | `Authorization: Bearer` na chamada à OpenAI |

Opcionais, com default:

| Variável | Default |
|---|---|
| `PORT` | `3000` |
| `OPENAI_MODEL` | `gpt-6-luna` |
| `ELEVENLABS_STT_MODEL` | `scribe_v4_turbo` |
| `ELEVENLABS_LANGUAGE_CODE` | `por` |
| `AGENT_HISTORY_LIMIT` | `40` |
| `AGENT_MAX_TOOL_ROUNDS` | `5` |
| `CORS_ORIGIN` | vazio; vazio significa sem CORS |

## Dados

Ids são UUID. Datas são `timestamptz`.

### `conversations`

| Coluna | Regra |
|---|---|
| `id` | PK |
| `phone` | único. Só dígitos, com DDI. É a identidade da conversa |
| `push_name` | último nome recebido; nulo se o evento não trouxer |
| `handoff` | boolean, default `false` |
| `created_at`, `updated_at` | `updated_at` muda a cada mensagem nova |

Conversa nasce na primeira mensagem inbound aceita. Não há endpoint para criar conversa.

### `messages`

| Coluna | Regra |
|---|---|
| `id` | PK |
| `conversation_id` | FK |
| `direction` | `inbound` ou `outbound` |
| `author` | `customer`, `agent` ou `operator` |
| `type` | `text`, `audio` ou `unsupported` |
| `body` | texto que o operador e o agente leem. Em áudio, é a transcrição. Em tipo não suportado, é um rótulo fixo |
| `status` | `stored`, `queued`, `sent` ou `failed` |
| `provider_message_id` | id do Evolution (`data.Info.ID` na entrada, `messageId` na saída). Único quando presente |
| `provider_timestamp` | timestamp do provedor, quando existir |
| `failure_reason` | texto curto, só em `failed` |
| `created_at` | ordem da conversa |

Não gravar base64, URL de mídia nem o envelope cru.

### `tool_executions`

| Coluna | Regra |
|---|---|
| `id` | PK |
| `conversation_id` | FK |
| `message_id` | mensagem inbound que originou o turno; nulo não ocorre neste fluxo |
| `name` | nome da tool |
| `arguments` | jsonb |
| `result` | jsonb; em erro, `{ "error": "..." }` |
| `status` | `success` ou `error` |
| `created_at` | |

## Normalização do telefone

Uma função só, usada na entrada e na saída.

1. Se o valor tiver `@`, ficar com o trecho anterior.
2. Remover tudo que não for dígito.
3. Número brasileiro móvel de 12 dígitos (`55` + DDD + 8 dígitos) ganha o nono dígito: `55` + DDD + `9` + 8 dígitos.
4. Os demais comprimentos permanecem como estão.

A busca da conversa usa sempre o resultado dessa função. O envio ao Evolution usa esses dígitos, sem `@` e sem `+`.

## Webhook

`POST /webhooks/evolution`.

Sem o token de operador. O corpo traz `instanceToken`. Valor diferente de `EVOLUTION_WEBHOOK_TOKEN` responde `401` e não enfileira. Token ausente na configuração impede o processo de subir.

Corpo válido: responder `200` com corpo vazio antes de qualquer I/O de banco, transcrição ou agente. O trabalho vai para a fila `inbound`. Limite do JSON: 25 MB, por causa do áudio em base64.

Evento processado: `event === "Message"`. Qualquer outro evento é descartado depois do `200`.

Descartar, sem gravar, quando:

- `data.Info.IsFromMe` é verdadeiro (eco do que este backend já enviou, ou mensagem digitada no aparelho)
- `data.Info.IsGroup` é verdadeiro, ou o chat termina em `@g.us`
- o chat termina em `@broadcast`
- não há `data.Info.ID` ou não há chat

Texto da mensagem, nesta ordem:

- `data.Message.conversation`
- `data.Message.extendedTextMessage.text` (também aceitar `ExtendedTextMessage.Text`)

Áudio quando `data.Info.MediaType === "audio"` ou existe `data.Message.audioMessage`. Bytes em `data.Message.base64`. Se em vez de base64 vier `data.Message.mediaUrl`, o worker baixa essa URL. Sem bytes e sem URL, a mensagem é gravada `failed` e o agente não roda.

Qualquer outra mídia (imagem, vídeo, documento, figurinha) vira `type = unsupported` e `body = "[mensagem não suportada]"`. Não chama transcrição nem agente.

Idempotência: `provider_message_id` único. Job repetido para um id já gravado não cria outra linha e não roda o agente de novo se a mensagem já saiu de `stored`.

## Filas

Redis é transporte. O Postgres é a memória.

As duas filas usam backoff exponencial, 3 tentativas, e removem da fila ao completar. Falha definitiva marca a mensagem como `failed` com `failure_reason`.

### `inbound`

Concurrency 1. Um número só não precisa de paralelismo, e concurrency 1 evita dois turnos do agente na mesma conversa.

O job carrega o envelope. O worker:

1. Aplica as regras de descarte.
2. Normaliza o telefone e abre ou atualiza a conversa (`push_name` quando vier em `data.Info.PushName`).
3. Insere a mensagem inbound. Texto entra `stored` com o corpo preenchido. Áudio entra `stored` com corpo vazio até a transcrição. Não suportada entra `stored` com o rótulo e o worker para.
4. Áudio: chama o port de transcrição. Sucesso grava a transcrição no `body` e mantém `type = audio`. Falha depois das tentativas deixa `failed` e o agente não roda.
5. Se `conversations.handoff` é verdadeiro, para. A mensagem já está visível para o operador.
6. Chama o agente com as últimas `AGENT_HISTORY_LIMIT` mensagens da conversa cuja `status` não é `failed`, em ordem cronológica, incluindo mensagens do operador.
7. Grava cada tool call em `tool_executions`.
8. Se `handoffRequested`, liga `conversations.handoff` e não envia o texto do modelo.
9. Se houver texto não vazio e o handoff não foi pedido, cria mensagem outbound `author = agent`, `status = queued`, e enfileira `outbound` com o id dessa mensagem.
10. Marca a inbound como `stored`. Ela permanece `stored`: `sent` é só de outbound. `failed` só quando a pipeline daquela inbound não pôde concluir.

Retomada: se o job reprocessar uma inbound que já tem outbound do agente associada, não cria outra. A associação é a outbound mais recente da conversa criada depois dessa inbound com `author = agent`. Implementação aceitável: coluna `reply_to_message_id` na outbound, preenchida com o id da inbound. Preferir essa coluna.

### `outbound`

Concurrency 2. Job carrega `messageId`.

1. Lê a mensagem. Se `status` já é `sent`, termina.
2. Atualização condicional `queued -> sent` só depois do envio bem-sucedido. Durante a tentativa, uma falha de rede mantém `queued` para o retry. Esgotadas as tentativas, `failed`.
3. `MessagingPort.sendText` chama `POST {EVOLUTION_BASE_URL}/send/text` com header `apikey` e corpo `{ "number", "text" }`.
4. Grava o id devolvido pelo Evolution em `provider_message_id`.

Operador e agente usam o mesmo caminho de outbound.

## Agente

O `AgentPort` é implementado com um `LlmAgent` do ADK. O modelo é a OpenAI, id `gpt-6-luna` (`OPENAI_MODEL`).

O registry do `@google/adk` 2.5.0 não conhece modelos OpenAI. Passar a string `gpt-6-luna` em `model` faz o ADK lançar `Model gpt-6-luna not found`. O `LlmAgent` recebe uma instância de `BaseLlm`.

Na instalação, procurar um conector oficial de OpenAI em `@google/adk` ou `@google/adk-integrations`. Se existir, usar esse conector com `OPENAI_API_KEY` e `OPENAI_MODEL`. Se não existir, `src/adapters/agent/openai-llm.ts` implementa `BaseLlm` e chama `POST https://api.openai.com/v1/chat/completions` com `model` igual a `OPENAI_MODEL`, header `Authorization: Bearer ${OPENAI_API_KEY}` e tools no formato function calling. Sem streaming. `connect()` rejeita: o modo live fica fora. O teste desse cliente mocka o HTTP e confere que o body manda `gpt-6-luna`. A suíte não chama a OpenAI.

- Instrução: conteúdo de `src/prompt/system.md`, uma linha em branco, conteúdo de `src/prompt/playbook.md`. Lidos do disco a cada turno, para um restart não ser necessário durante o desenvolvimento do texto.
- O histórico vem do Postgres e é passado no turno. A sessão em memória do ADK não é fonte de verdade.
- Tools vêm de `src/tools/registry.ts`. Cada tool tem `name`, `description`, schema Zod e `execute(args, ctx)`, com `ctx = { conversationId, phone }`.
- O resultado de `execute` precisa ser JSON. Exceção vira tool call `error` e também volta para o modelo como falha da tool, para ele poder responder ao cliente.
- No máximo `AGENT_MAX_TOOL_ROUNDS` rodadas de tool por turno. Ao estourar, grava as execuções já feitas, não envia texto ao cliente e marca a inbound como `failed`.
- Texto vazio e sem handoff: não cria outbound. A inbound fica `stored`.

`src/prompt/system.md` deve nascer com estas regras, em português:

- O atendente responde em português, curto, com base no histórico e no playbook.
- Não inventa dado que não esteja no playbook, no histórico ou no retorno de uma tool.
- Quando a situação pedir uma pessoa, chama `request_handoff` com um motivo curto e não escreve mensagem para o cliente nesse turno.
- Situações de handoff: o cliente pede humano, o assunto está fora do playbook, ou uma tool falhou e a conversa não pode seguir só com o que o playbook autoriza.
- `playbook.md` nasce com um título e um parágrafo placeholder dizendo que o conteúdo do negócio será preenchido pelo dono do repositório.

### Tool `request_handoff`

Registrada junto com as demais. Argumento: `reason` (string, obrigatório). `execute` não altera o banco; devolve `{ accepted: true, reason }`. O pipeline, ao ver essa call com sucesso, liga o handoff e suprime o outbound. O motivo fica em `tool_executions.arguments` e aparece na API.

### Tool `current_time`

Exemplo de tool de negócio. Sem argumentos. Devolve `{ iso: "<ISO-8601 em America/Sao_Paulo>" }`. Existe para o registro, o teste e o prompt terem uma tool real além do handoff. Tools novas entram nesse registry e em lugar nenhum mais.

## Handoff

Estado por conversa, coluna `handoff`.

- Ligado pelo agente, via `request_handoff`, ou pelo operador, via API.
- Desligado só pelo operador, via API. O agente não tem tool para desligar.
- Com handoff ligado, inbound continua sendo gravado e áudio continua sendo transcrito. O agente não roda.
- Mensagem do operador pode ser enviada com handoff ligado ou desligado. Enviar mensagem não muda o flag.
- Ao desligar, a próxima mensagem do cliente volta a passar pelo agente, que enxerga no histórico o que o operador escreveu.

## Transcrição

`POST https://api.elevenlabs.io/v1/speech-to-text`, multipart:

- `file`: bytes do áudio, com o mimetype do evento (`audio/ogg` quando o Evolution indicar opus)
- `model_id`: `ELEVENLABS_STT_MODEL` (`scribe_v4_turbo`)
- `language_code`: `ELEVENLABS_LANGUAGE_CODE`
- `tag_audio_events`: `false`

Header `xi-api-key`. O texto usado é o campo `text` da resposta, com trim. String vazia trata como falha.

## API do operador

Contrato em `openapi.yaml`, validação das entradas com Zod. Todas as rotas abaixo exigem `Authorization: Bearer <API_TOKEN>`. Comparação em tempo constante. Ausente ou diferente: `401` com `{ "error": "unauthorized" }`.

Erros: `{ "error": string }`. UUID inválido ou conversa inexistente: `404`. Body inválido: `400`.

### `GET /health`

Sem autenticação. `200` com `{ "ok": true }`. Não consulta dependências.

### `GET /ready`

Sem autenticação. `200` quando Postgres e Redis respondem. `503` quando um deles falha.

### `GET /conversations`

Query: `limit` default 30, máximo 100; `cursor` opaco.

Ordem: `updated_at` decrescente, desempate por `id`.

```json
{
  "items": [
    {
      "id": "uuid",
      "phone": "5511999999999",
      "pushName": "Ana",
      "handoff": false,
      "lastMessage": {
        "body": "oi",
        "author": "customer",
        "createdAt": "2026-11-17T12:00:00.000Z"
      },
      "updatedAt": "2026-11-17T12:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

`lastMessage` é nulo só se a conversa não tiver mensagem visível. Mensagem `failed` sem corpo não serve como preview; usar a anterior que tenha corpo.

### `GET /conversations/:id`

A conversa, mais `recentToolExecutions`: as 20 execuções mais recentes, da mais nova para a mais antiga. O mesmo formato de item do endpoint de tools.

### `GET /conversations/:id/messages`

Query: `limit` default 50, máximo 100; `cursor`.

Ordem cronológica crescente (a tela desenha o chat de cima para baixo). O cursor pede a página mais antiga. Inclui `failed`, para o operador ver a falha.

```json
{
  "items": [
    {
      "id": "uuid",
      "direction": "inbound",
      "author": "customer",
      "type": "audio",
      "body": "quero falar com uma pessoa",
      "status": "stored",
      "failureReason": null,
      "createdAt": "2026-11-17T12:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

### `GET /conversations/:id/tool-executions`

As execuções da conversa, mais recente primeiro. `limit` default 50, máximo 100.

```json
{
  "items": [
    {
      "id": "uuid",
      "messageId": "uuid",
      "name": "request_handoff",
      "arguments": { "reason": "cliente pediu humano" },
      "result": { "accepted": true, "reason": "cliente pediu humano" },
      "status": "success",
      "createdAt": "2026-11-17T12:00:00.000Z"
    }
  ],
  "nextCursor": null
}
```

### `POST /conversations/:id/messages`

Body: `{ "text": string }` com 1 a 4000 caracteres depois do trim.

Cria outbound `author = operator`, `status = queued`, enfileira, responde `202` com a mensagem. O `status` na resposta é `queued`. O envio acontece no worker.

### `POST /conversations/:id/handoff`

Body: `{ "enabled": boolean }`.

Responde `200` com `{ "id", "handoff" }`. Valor igual ao atual também responde `200`.

## Testes

TDD: para cada comportamento abaixo, o teste nasce falhando e a implementação vem em seguida.

Unidade, com fakes dos ports:

- normalização: JID, máscara, nono dígito, número que já tem 13 dígitos
- parser do webhook: texto, texto estendido, áudio com base64, grupo, fromMe, broadcast, evento que não é `Message`, token inválido
- pipeline: handoff ligado não chama o agente e grava a mensagem; handoff desligado chama o agente e enfileira uma outbound; `request_handoff` liga o flag e não enfileira; tool comum grava `tool_executions` e o texto final é enviado; transcrição preenche o body do áudio; falha de transcrição não chama o agente; mídia não suportada não chama o agente; segundo job com o mesmo `provider_message_id` não duplica
- auth: sem header, token errado, token certo
- operador: enviar mensagem enfileira outbound e não mexe no handoff; ligar e desligar handoff

Integração, contra o Postgres do Compose, quando `DATABASE_URL` estiver definido:

- repositórios de conversa, mensagem e tool execution
- unicidade de `phone` e de `provider_message_id`

Os adapters do Evolution, da ElevenLabs e da OpenAI ficam com teste de unidade do cliente HTTP mockado. Não chamar as APIs reais na suíte.

## Ordem de implementação

Cada fase termina com seus testes verdes antes da próxima.

1. Compose, config, Drizzle, migração, `/health` e `/ready`.
2. Normalização e repositórios.
3. Auth e API de leitura (conversas, mensagens, tool executions) com dados inseridos pelo teste.
4. Webhook, fila inbound e persistência de texto, incluindo descarte e idempotência.
5. Fila outbound, adapter do Evolution e `POST /conversations/:id/messages`.
6. Handoff na pipeline e `POST /conversations/:id/handoff`.
7. AgentPort com ADK, OpenAI `gpt-6-luna`, prompts, `request_handoff`, `current_time`, gravação das tools e resposta automática.
8. Áudio via ElevenLabs `scribe_v4_turbo` e mensagens não suportadas.
9. `openapi.yaml` cobrindo a API do operador e o webhook.

## Pronto quando

- Um `POST` de texto no webhook, com a conversa sem handoff, gera uma resposta do agente no Evolution e as duas mensagens aparecem em `GET /conversations/:id/messages`.
- Um áudio no webhook aparece para o operador como texto transcrito e esse texto é o que o agente lê.
- Com handoff ligado, o cliente é gravado, o agente não é chamado e o `POST` do operador sai pelo Evolution.
- `request_handoff` liga o flag, registra a tool e não envia a fala do modelo.
- O operador desliga o handoff e a mensagem seguinte do cliente volta a ser respondida pelo agente, com as falas do operador no histórico.
- Tool registrada em código executa, persiste argumentos e resultado, e o modelo recebe esse resultado no mesmo turno.
- Webhook repetido com o mesmo id do Evolution não duplica mensagem nem resposta.
- Rotas do operador sem o Bearer token recebem `401`.
- `docker compose up` sobe api, Postgres e Redis, aplica a migração e deixa `/ready` em 200.
