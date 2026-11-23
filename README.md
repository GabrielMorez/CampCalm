# CampCalm

Projeto acadêmico de Engenharia de Software — UNIASSELVI.

O **CampCalm** pretende facilitar a localização de campings em operação, a consulta de disponibilidade e a solicitação de reservas, centralizando informações que costumam estar distribuídas entre redes sociais e aplicativos de mensagens.

## Objetivo

Permitir que um campista localize campings em operação dentro de um raio definido a partir de sua posição, consulte vagas disponíveis e solicite uma reserva sem sair da aplicação.

## Escopo do MVP

- Cadastro de perfil do campista;
- Cadastro de camping, localização, vagas e valores;
- Busca de campings por proximidade;
- Consulta de vagas, datas disponíveis e valores;
- Solicitação de reserva;
- Aceite ou recusa manual pelo camping;
- Consulta de reservas ativas pelo camping;
- Cadastro/categorização de espaços por tipo de acomodação (barraca, motorhome ou trailer).

O histórico do campista durante o aceite (RF-011) será implementado **após o MVP**. O cancelamento pelo campista (RF-013) também está fora do MVP.

## Arquitetura

- **Apresentação:** React + TypeScript + Vite + Capacitor (web e aplicativo mobile; ainda não implementado).
- **Aplicação:** casos de uso do backend Node.js + TypeScript.
- **Domínio:** entidades, objetos de valor, regras de negócio e interfaces independentes de infraestrutura.
- **Infraestrutura:** PostgreSQL 17 com PostGIS em Docker para desenvolvimento, persistência real a implementar.

## Estrutura

```text
backend/          Domínio, aplicação e futura API
frontend/         Aplicação web e mobile (a implementar)
database/         Migrações SQL, consultas e testes de integridade
docs/             Evidências e documentação de arquitetura
.github/          CI e templates
```

## Começar pelo banco

Veja **[database/README.md](database/README.md)** para criar o PostgreSQL/PostGIS e aplicar migrações usando Docker Compose, sem alterar o backend existente.

## Estado atual

A arquitetura de domínio e os testes unitários iniciais existem. O esquema PostgreSQL e o Compose estão preparados, mas a execução Docker, a API HTTP, as implementações Postgres dos repositórios e o frontend ainda precisam ser realizados/validados.

**Autor:** Gabriel Morez dos Santos — Engenharia de Software, UNIASSELVI.
