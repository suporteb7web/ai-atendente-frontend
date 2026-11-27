Projeto: Atendente de WhatsApp

Este é o backend. Sem multi-tenancy: uma instância Evolution, um número, e todas as conversas desse número. Cada telefone normalizado é uma conversa.

Tech:
- Docker Compose
- BullMQ
- Express + Typescript
- EvolutionGo
- OpenAPI
- Google ADK com OpenAI, modelo gpt-6-luna
- PostgreSQL
- DrizzleORM
- ElevenLabs (transcrição de áudio, scribe_v4_turbo)

Arquitetura:
- Controllers e Services
- TDD
- EvolutionGo atrás de um Adapter para no futuro usar WhatsApp API Oficial / Kapso
- System prompt e playbook em arquivo/pasta próprio no repositório
- Tools registradas em código
- Postgres guarda mensagens, conversas, handoff e execuções de tool. BullMQ só transporta inbound e outbound

Funcionalidades:
- inbound e outbound na queue
- Normalização do número
- Várias conversas no mesmo número
- Áudio inbound vira texto via ElevenLabs antes do agente
- Handoff por conversa: o agente aciona quando o prompt manda; com handoff ligado o agente não responde; o operador responde pelo frontend e a mensagem sai na fila de outbound; o operador desliga o handoff para o agente voltar
- Agente executa tool

API do frontend:
- Listar conversas
- Ler histórico
- Ver estado do handoff e tools executadas
- Enviar mensagem como humano
- Ligar e desligar handoff
- Autenticação por token simples no header Authorization
