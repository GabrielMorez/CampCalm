# Backend CampCalm

Backend do CampCalm estruturado em TypeScript com separação entre domínio, aplicação e infraestrutura.

## Requisitos

- Node.js 24+ (conforme `package.json` e workflow atual)
- npm
- Docker Compose para o PostgreSQL/PostGIS local (veja `../database/README.md`)

## Instalação e comandos existentes

```bash
cd backend
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm start
```

**Importante:** `src/index.ts` atualmente exporta metadados/health status, mas **não cria um servidor HTTP**. Não existe API pública para publicar neste estágio.

## Organização

```text
src/
├── application/use-cases/
├── domain/
│   ├── entities/
│   ├── errors/
│   ├── repositories/
│   └── value-objects/
└── infrastructure/repositories/
tests/
```

O domínio não depende de banco de dados nem de frameworks HTTP. Atualmente, `CreateReservationUseCase` valida camping/vaga e consulta conflitos antes de gravar uma reserva `PENDING`, utilizando um repositório em memória nos testes.

## Etapa de banco de dados

O esquema SQL foi acrescentado em `../database/migrations/001_initial_schema.sql`, com PostGIS e restrição de exclusão para conflitos. **Nenhum repositório PostgreSQL nem integração do caso de uso ao banco foi implementado nesta etapa.** O próximo passo será introduzir a conexão e transações mantendo as interfaces de domínio independentes.
