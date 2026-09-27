# CampCalm Backend

Backend do CampCalm estruturado em TypeScript, com separação entre aplicação, domínio e infraestrutura.

## Requisitos

- Node.js 20 ou superior
- npm

## Instalação

```bash
cd backend
npm install
```

## Comandos

```bash
npm run dev        # executa o entry point em modo watch
npm run typecheck  # valida os tipos sem gerar build
npm test           # executa os testes com Vitest
npm run build      # compila o TypeScript para dist/
npm start          # executa o build compilado
```

## Organização

```text
src/
├── application/
│   └── use-cases/
├── domain/
│   ├── entities/
│   ├── errors/
│   ├── repositories/
│   └── value-objects/
└── infrastructure/
    └── repositories/

tests/
├── application/
└── domain/
```

### Domínio

O domínio contém entidades, objetos de valor, invariantes e contratos de repositório. Ele não depende de banco de dados, HTTP ou interface gráfica.

### Aplicação

A camada de aplicação coordena os casos de uso. A primeira implementação é `CreateReservationUseCase`, responsável por validar camping, lote e conflitos antes de criar uma reserva pendente.

### Infraestrutura

A infraestrutura implementa os contratos declarados pelo domínio. Neste estágio existe um repositório de reservas em memória para permitir execução e testes das regras antes da adoção do PostgreSQL.

## Estado atual

Já estão implementados:

- `Camper`;
- `Camping`;
- `Space`;
- `Reservation`;
- `Period`;
- `Money`;
- erros de domínio;
- contratos de repositório;
- repositório de reservas em memória;
- criação de reserva com prevenção de conflito;
- testes unitários iniciais.

A persistência PostgreSQL/PostGIS e a API HTTP serão adicionadas em etapas posteriores.
