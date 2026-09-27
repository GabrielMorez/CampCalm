# Backend

API, domínio, casos de uso e infraestrutura do CampCalm.

Estrutura planejada:

```text
src/
  application/
    use-cases/
  domain/
    entities/
    errors/
    repositories/
    value-objects/
  infrastructure/
    database/
    repositories/
tests/
  domain/
```

A primeira implementação deverá priorizar o domínio e seus testes isolados antes da persistência e da interface.
