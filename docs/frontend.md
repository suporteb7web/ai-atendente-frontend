# Frontend do atendente

O frontend consome a API descrita em `openapi.yaml`. Há um número de WhatsApp e várias conversas, uma por telefone. Não há login de vários operadores: um token compartilhado abre o painel.

## Base e autenticação

A base local do Compose é `http://localhost:3000`.

Todas as rotas de operador enviam:

```http
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

Sem o header, ou com outro token, a resposta é `401`:

```json
{ "error": "unauthorized" }
```

`GET /health` e `GET /ready` não usam o token. `/health` só diz que o processo está no ar. `/ready` devolve `200` com `{ "ok": true }` quando Postgres e Redis respondem, e `503` quando um dos dois falha. Use `/ready` no healthcheck de deploy, não para pintar a tela.

Se `CORS_ORIGIN` estiver vazio, o backend não envia cabeçalhos de CORS. Em desenvolvimento, aponte essa variável para a origem do frontend, por exemplo `http://localhost:5173`.

## O que a tela mostra

Duas superfícies bastam:

1. Lista de conversas, da que recebeu mensagem por último até a mais antiga.
2. Conversa aberta: histórico, handoff, tools e o campo de resposta do operador.

Não existe cadastro de conversa. A linha nasce quando o cliente manda a primeira mensagem aceita.

### Conversa

```json
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
```

`phone` é só dígito, com DDI. Mostre `pushName` quando existir e o telefone como apoio. `lastMessage` é nulo só quando a conversa ainda não tem mensagem com texto. Mensagem `failed` sem corpo não entra no preview; a anterior com corpo entra. Áudio aparece aqui já como transcrição. Figurinha, imagem, vídeo e documento aparecem como `[mensagem não suportada]`.

`GET /conversations/:id` devolve os mesmos campos, mais `createdAt` e `recentToolExecutions` com as 20 execuções mais novas.

### Mensagem

```json
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
```

| Campo               | Como desenhar                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| `author: customer`  | Balão do cliente, à esquerda                                                                               |
| `author: agent`     | Balão do atendente automático                                                                              |
| `author: operator`  | Balão do humano, distinto do agente                                                                        |
| `type: text`        | `body`                                                                                                     |
| `type: audio`       | `body` é a transcrição. Vale um rótulo discreto de que era áudio. Não há player: o áudio não fica guardado |
| `type: unsupported` | Mostre o `body`, que é sempre `[mensagem não suportada]`                                                   |
| `status: stored`    | Mensagem de entrada concluída, ou áudio já transcrito                                                      |
| `status: queued`    | Saída aceita, ainda não confirmada pelo WhatsApp                                                           |
| `status: sent`      | Saída confirmada                                                                                           |
| `status: failed`    | Mostre `failureReason`. A linha continua no histórico                                                      |

`sent` só existe em saída. Entrada fica `stored`, ou `failed` quando a transcrição, o agente ou o limite de tools não conclui.

## Rotas

### Lista

`GET /conversations?limit=30&cursor=`

`limit` default 30, máximo 100. A ordem é `updatedAt` decrescente, desempate por `id`. A primeira página é o topo da lista. Se `nextCursor` não for nulo, peça a próxima página com esse cursor para carregar conversas mais antigas. O cursor é opaco: guarde a string e devolva igual. `limit` fora de 1–100 ou cursor quebrado responde `400` com `{ "error": "..." }`.

### Histórico

`GET /conversations/:id/messages?limit=50&cursor=`

`limit` default 50, máximo 100. Os itens da página vêm em ordem cronológica, de cima para baixo. A primeira página é a janela mais recente. `nextCursor` pede a página mais antiga: use isso no scroll para cima. A resposta inclui `failed`, para o operador ver a falha.

UUID inválido e conversa inexistente respondem `404` com `{ "error": "não encontrado" }`.

### Tools

`GET /conversations/:id/tool-executions?limit=50`

A página vem da mais nova para a mais antiga. Cada item:

```json
{
  "id": "uuid",
  "messageId": "uuid",
  "name": "request_handoff",
  "arguments": { "reason": "cliente pediu humano" },
  "result": { "accepted": true, "reason": "cliente pediu humano" },
  "status": "success",
  "createdAt": "2026-11-17T12:00:00.000Z"
}
```

`messageId` aponta para a mensagem do cliente que originou o turno. Dá para ancorar a tool naquele balão. `status: error` traz `result` no formato `{ "error": "..." }`. O detalhe da conversa já traz as 20 mais novas, então a primeira pintura não precisa desta rota; use a rota paginada se o operador abrir o histórico de tools.

Hoje o backend registra duas tools: `current_time` e `request_handoff`. Novas tools aparecem com o mesmo formato. Não construa uma tela para cadastrar tool ou editar prompt. O texto do agente mora em `src/prompt/` e muda no repositório.

### Enviar como operador

`POST /conversations/:id/messages`

```json
{ "text": "já estou vendo" }
```

O texto tem de 1 a 4000 caracteres depois do trim. A resposta é `202` com a mensagem e `status: "queued"`. O envio é assíncrono. Enviar não liga nem desliga o handoff. Pode enviar com o handoff ligado ou desligado.

Atualize o balão quando um refetch trouxer `sent` ou `failed`. Não marque como enviado no clique.

### Handoff

`POST /conversations/:id/handoff`

```json
{ "enabled": true }
```

Resposta `200`: `{ "id", "handoff" }`. Mandar o valor que já está gravado também dá `200`.

O handoff é por conversa.

- Ligado: o cliente continua sendo gravado e o áudio continua sendo transcrito, mas o agente não responde. O operador responde pelo campo de mensagem.
- Desligado: a próxima mensagem do cliente volta a passar pelo agente. O agente enxerga, no histórico, o que o operador escreveu.
- O agente também liga o handoff sozinho, chamando `request_handoff`. Nesse turno a fala do modelo não é enviada. O motivo fica em `arguments.reason` da tool.
- Só o operador desliga. Não há botão de “devolver ao agente” escondido em outro endpoint: é este POST com `enabled: false`.

Um interruptor ao lado do nome da conversa é o controle certo. Quando `handoff` está ligado, deixe isso visível também na lista.

## Atualização

Não há websocket nem webhook para o browser. Faça polling enquanto a conversa estiver aberta e a lista estiver visível. Um intervalo de 2 segundos é suficiente para um número só.

Em cada ciclo:

- refetch da lista, para `updatedAt`, `lastMessage` e `handoff`;
- refetch da primeira página de mensagens da conversa aberta;
- refetch de `GET /conversations/:id` se a barra de handoff e as tools recentes estiverem na tela.

Ao paginar para cima, não jogue fora as páginas antigas já carregadas. Junte pelo `id` da mensagem. Uma mensagem `queued` pode mudar para `sent` ou `failed` sem mudar de lugar.

## Erros na interface

O corpo de erro é sempre `{ "error": string }`.

| Status | Onde                                          | O que fazer                                                    |
| ------ | --------------------------------------------- | -------------------------------------------------------------- |
| 401    | qualquer rota de operador                     | Token ausente ou errado. Peça o token de novo e pare de pollar |
| 404    | `:id` inválido ou conversa que não existe     | Tire a conversa da tela                                        |
| 400    | texto vazio, texto longo, `limit` ou `cursor` | Mostre a mensagem e não reenvie igual                          |
| 503    | `/ready`                                      | Fora do fluxo da tela                                          |

Não existe endpoint para editar prompt, cadastrar tool, disparar mensagem ativa, mandar áudio, imagem ou documento, nem para ler grupo ou recibo.

## Sequência sugerida

1. Guardar o token fora do código versionado e mandar o Bearer em todas as chamadas de operador.
2. Lista com `GET /conversations`.
3. Ao abrir uma linha, `GET /conversations/:id/messages` e pintar de cima para baixo.
4. Campo de texto chama `POST /conversations/:id/messages` e entra o balão `queued` na hora, com o corpo do `202`.
5. Interruptor chama `POST /conversations/:id/handoff`.
6. Painel lateral lê `recentToolExecutions` do detalhe.
7. Polling atualiza status, mensagem nova e handoff que o agente ligou sozinho.
