# CampCalm

O **CampCalm** é uma aplicação desenvolvida como projeto acadêmico do curso de Engenharia de Software da UNIASSELVI.

O projeto tem como objetivo facilitar a localização de campings, a consulta de disponibilidade e a solicitação de reservas, centralizando informações que hoje costumam ser obtidas por redes sociais, mecanismos de busca e aplicativos de mensagens.

## Objetivo

Permitir que um campista localize campings em operação dentro de um raio definido a partir de sua posição, consulte vagas disponíveis e solicite uma reserva sem sair da aplicação.

## Escopo do MVP

O MVP contempla:

- Cadastro de perfil do campista;
- Cadastro de camping, localização, vagas e valores;
- Busca de campings por proximidade;
- Consulta de vagas e datas disponíveis;
- Solicitação de reserva;
- Aceite ou recusa da reserva pelo camping;
- Consulta das reservas ativas pelo camping.

## Arquitetura

A aplicação será organizada nas seguintes camadas:

- **Apresentação**
- **Aplicação**
- **Domínio**
- **Infraestrutura**

A camada de domínio concentra as regras de negócio e não possui dependência direta de banco de dados, interface gráfica ou serviços externos.

## Estrutura do repositório

```text
frontend/     Aplicação web/mobile
backend/      API, domínio e regras de negócio
docs/         Documentação acadêmica e técnica
.github/      Configurações e templates do GitHub
```

## Tecnologias previstas

### Frontend

- React
- TypeScript

### Backend

- Node.js
- TypeScript

### Persistência

- PostgreSQL
- PostGIS para consultas geográficas, quando disponível

## Status

🚧 Projeto em desenvolvimento.

Atualmente o projeto encontra-se nas etapas de definição arquitetural e implementação inicial do domínio.

## Autor

**Gabriel Morez dos Santos**

Engenharia de Software — UNIASSELVI
