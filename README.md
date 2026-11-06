# PetCare · Gestão de Pet Shop

Sistema de gestão de pets para um pet shop, desenvolvido como **projeto parcial da disciplina PTAS3 (Semana 10)**.

O projeto aplica o conteúdo de **CRUD REST em camadas** e de **consumo centralizado de API no React**:

- API REST em **Express** com as camadas `routes → controllers → services → models`.
- Persistência inicial em **JSON**, sem banco de dados externo.
- Validação de entrada com **zod** em `POST` e `PUT`.
- Middlewares de **JSON**, **log de requisições**, **404** e **erro centralizado**.
- **Soft delete** com restauração do cadastro.
- Painel **React + Vite** responsivo, com busca, filtros, ficha do pet, formulário e estados de carregamento/erro.

Tema: **Pet Shop** — cadastro de pets, tutores e contatos.
Integrantes: **Marjorie da Silva Santos** e **Iasmim Bueno Othechar**.

---

## 1. Como rodar

Pré-requisito: **Node.js 18 ou superior**.

```bash
# na raiz do projeto
npm install
npm run dev
```

O comando acima sobe os dois processos ao mesmo tempo:

| Serviço | URL |
| --- | --- |
| API | http://localhost:3000 |
| Painel React | http://localhost:5173 |

Também é possível rodar separadamente:

```bash
npm run dev:backend    # apenas a API (nodemon)
npm run dev:frontend   # apenas o painel React
npm run start:backend  # API sem nodemon
npm run test:api       # testes automatizados da API
npm run build:frontend # build de produção do React
```

### Variáveis de ambiente (opcionais)

Os valores padrão já funcionam sem criar arquivo `.env`.

`backend/.env` (baseado em `backend/.env.example`):

```env
PORT=3000
CORS_ORIGIN=http://localhost:5173
```

`frontend/.env` (baseado em `frontend/.env.example`):

```env
VITE_API_URL=http://localhost:3000
```

O CORS aceita várias origens separadas por vírgula. Em produção, não use `*`.

### Testes rápidos da API

Com a API rodando, execute em outro terminal:

```bash
npm run test:api
```

O script `backend/tests/api.test.mjs` valida o CRUD completo, os erros `400`, `404` e `204`, o soft delete e a restauração. Ao final, ele remove apenas o pet criado para o teste, sem alterar os demais cadastros.

Também é possível testar manualmente pelo navegador:

- http://localhost:3000/health — status da API
- http://localhost:3000/api — lista de endpoints
- http://localhost:3000/pets — pets ativos
- http://localhost:3000/pets?includeDeleted=true — ativos + arquivados

Exemplos de `curl` para criar, atualizar, arquivar e restaurar estão na [seção 3](#3-endpoints-da-api).

---

## 2. Estrutura do projeto

```text
pet-shop/
├── backend/
│   ├── controllers/
│   │   └── pets.controller.js      # traduz HTTP <-> service e define status
│   ├── data/
│   │   ├── db.js                   # leitura/escrita atômica do JSON
│   │   └── pets.json               # "banco" com 10 pets ativos + 2 arquivados
│   ├── errors/
│   │   └── http-error.js           # erro com status e detalhes de validação
│   ├── middleware/
│   │   ├── error.middleware.js     # handler de erro centralizado
│   │   ├── log.middleware.js       # log de método, rota, status e duração
│   │   ├── not-found.middleware.js # 404 para rotas inexistentes
│   │   └── validate.middleware.js  # converte schema zod em middleware
│   ├── models/
│   │   └── pets.model.js           # CRUD sobre o arquivo JSON
│   ├── routes/
│   │   └── pets.routes.js          # rotas /pets
│   ├── schemas/
│   │   └── pet.schema.js           # schemas zod de criação e atualização
│   ├── services/
│   │   └── pets.service.js         # regras de negócio e soft delete
│   ├── .env.example
│   ├── package.json
│   └── server.js                   # entrada da API
├── frontend/
│   ├── app/
│   │   └── App.jsx                 # estado, filtros, visões e mutações
│   ├── components/                 # Sidebar, Topbar, tabela, modais, drawer...
│   ├── hooks/
│   │   ├── usePets.js              # carregamento da lista
│   │   └── useToasts.js            # notificações
│   ├── services/
│   │   ├── api.js                  # fetch centralizado + ApiError (Aula 07)
│   │   └── pets.api.js             # endpoints de pets
│   ├── styles/
│   │   └── global.css              # design system e responsividade
│   ├── utils/
│   │   └── format.js               # datas, idade, telefone e iniciais
│   ├── index.html
│   ├── main.jsx
│   ├── vite.config.js
│   └── package.json
├── package.json                    # workspaces + concurrently
└── README.md
```

### Fluxo de uma requisição

```text
React (services/api.js)
        │  fetch HTTP
        ▼
server.js → middleware de log → routes
                                   │
                                   ▼
                              validate (zod)  → 400 se inválido
                                   │
                                   ▼
                              controller       → define 200/201/204/404
                                   │
                                   ▼
                                service        → regras de negócio
                                   │
                                   ▼
                                 model         → data/db.js
                                   │
                                   ▼
                            backend/data/pets.json
```

O controller não conhece o arquivo JSON. O model não conhece HTTP. O service concentra as regras (inclusive o soft delete).

---

## 3. Endpoints da API

Base: `http://localhost:3000`

| Método | Rota | Descrição | Sucesso |
| --- | --- | --- | --- |
| GET | `/` | Identificação da API | 200 |
| GET | `/api` | Lista de endpoints disponíveis | 200 |
| GET | `/health` | Status da API e contagem de registros | 200 |
| GET | `/pets` | Lista os pets ativos | 200 |
| GET | `/pets?includeDeleted=true` | Lista ativos e arquivados | 200 |
| GET | `/pets/:id` | Detalhe de um pet ativo | 200 / 404 |
| POST | `/pets` | Cria um pet | 201 / 400 |
| PUT | `/pets/:id` | Atualiza um pet (parcial) | 200 / 400 / 404 |
| DELETE | `/pets/:id` | Arquiva um pet — soft delete | 204 / 404 |
| POST | `/pets/:id/restore` | Restaura um pet arquivado | 200 / 404 |

### Exemplo de criação

```bash
curl -X POST http://localhost:3000/pets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Bolinha",
    "species": "cao",
    "breed": "Beagle",
    "size": "medio",
    "birthDate": "2021-06-15",
    "tutor": {
      "name": "Marjorie Santos",
      "phone": "(67) 99999-1234",
      "email": "marjorie@email.com"
    },
    "notes": "Alergia a frango."
  }'
```

Resposta `201 Created`:

```json
{
  "id": "3ea3bb0e-6e5d-44ab-a894-2ed2dfef5dc9",
  "name": "Bolinha",
  "species": "cao",
  "breed": "Beagle",
  "size": "medio",
  "birthDate": "2021-06-15",
  "tutor": {
    "name": "Marjorie Santos",
    "phone": "(67) 99999-1234",
    "email": "marjorie@email.com"
  },
  "notes": "Alergia a frango.",
  "createdAt": "2026-11-01T17:14:58.934Z",
  "updatedAt": "2026-11-01T17:14:58.934Z",
  "deletedAt": null
}
```

### Exemplo de atualização parcial

```bash
curl -X PUT http://localhost:3000/pets/8f14e45f-ceea-4f7e-9f3e-1a2b3c4d5e01 \
  -H "Content-Type: application/json" \
  -d '{"notes":"Agora usa shampoo neutro."}'
```

No `PUT`, o `tutor` enviado é mesclado com o tutor atual: é possível alterar só o telefone sem reenviar nome e e-mail.

### Soft delete e restauração

```bash
# Arquiva (não apaga do JSON)
curl -X DELETE http://localhost:3000/pets/8f14e45f-ceea-4f7e-9f3e-1a2b3c4d5e01

# Restaura
curl -X POST http://localhost:3000/pets/8f14e45f-ceea-4f7e-9f3e-1a2b3c4d5e01/restore
```

O `DELETE` grava `deletedAt` com a data/hora. O registro continua no arquivo, mas sai da listagem ativa, dos indicadores e do `GET /pets/:id`. Pets arquivados também não podem ser editados até serem restaurados.

---

## 4. Validação com zod

Schemas em `backend/schemas/pet.schema.js`:

- `createPetSchema` — obrigatórios: `name`, `species`, `size` e `tutor.name` + `tutor.phone`.
- `updatePetSchema` — todos os campos opcionais, mas exige **pelo menos um campo**.
- `.strict()` — campos desconhecidos são rejeitados.
- `species`: `cao`, `gato`, `ave`, `roedor`, `reptil`, `outro`.
- `size`: `pequeno`, `medio`, `grande`.
- Telefone com DDD, e-mail válido, data `AAAA-MM-DD` real e não futura.
- Campos de texto opcionais vazios são normalizados para `null`.

Resposta `400 Bad Request`:

```json
{
  "message": "Dados inválidos",
  "errors": [
    { "field": "tutor.phone", "message": "Informe um telefone válido com DDD" }
  ]
}
```

O formulário do frontend repete as regras principais antes do envio, mas a **API é a fonte da verdade**.

---

## 5. Códigos de status usados

| Código | Quando acontece |
| --- | --- |
| **200** | Listagem, detalhe, atualização e restauração com sucesso |
| **201** | Pet criado com sucesso |
| **204** | Pet arquivado com sucesso, sem corpo na resposta |
| **400** | Corpo inválido pelo zod, JSON malformado ou `PUT` sem campos |
| **404** | Rota inexistente, pet inexistente ou pet arquivado |
| **500** | Falha inesperada, tratada pelo handler centralizado |

O handler centralizado (`error.middleware.js`) é o único lugar que monta respostas de erro. Erros `500` não expõem detalhes internos ao cliente; o stack trace fica no console do servidor.

---

## 6. Persistência JSON

`backend/data/db.js` funciona como uma camada de banco:

- Toda leitura/escrita passa por ele.
- Escritas são serializadas em uma fila (`writeQueue`), evitando perda de dados em requisições simultâneas.
- A gravação usa arquivo temporário + `rename`, então o JSON nunca fica pela metade.
- Na primeira execução, se `pets.json` não existir, o arquivo é criado.
- A base inicial tem **10 pets ativos e 2 arquivados**, com dados fictícios de tutores.

Para zerar os dados, pare a API, substitua `backend/data/pets.json` por `[]` e suba novamente.

---

## 7. Frontend

- **React 18 + Vite**, sem framework de UI.
- `services/api.js` centraliza `fetch`, URL base, tratamento de `204`, erros de rede e a classe `ApiError` (conteúdo da Aula 07).
- `hooks/usePets.js` carrega a lista com `includeDeleted=true`; o painel separa ativos e arquivados.
- Visão geral com indicadores, busca por pet/tutor/e-mail/telefone, filtro por espécie e tabela responsiva.
- Modal de cadastro/edição com validação e mensagens por campo.
- Drawer de ficha do pet com ações de editar, arquivar e restaurar.
- Confirmação antes do soft delete e toasts de sucesso/erro.
- Estados de **carregando** (skeleton), **erro** (com botão de tentar novamente), **vazio** e **API offline**.
- Modal "Sobre o projeto" explica a arquitetura e o soft delete.

---

## 8. Como o projeto atende ao enunciado

| Requisito | Onde está |
| --- | --- |
| CRUD REST de um recurso | `/pets` — listar, detalhar, criar, atualizar e remover |
| Camadas `routes → controllers → services → models` | Pastas equivalentes em `backend/` |
| Persistência inicial em JSON | `backend/data/db.js` + `backend/data/pets.json` |
| Validação com zod em POST e PUT | `backend/schemas/pet.schema.js` + `validate.middleware.js` |
| `express.json` | `backend/server.js` |
| Log de requisições | `backend/middleware/log.middleware.js` |
| Handler de erro centralizado | `backend/middleware/error.middleware.js` |
| Status 200, 201, 204, 400, 404, 500 | `pets.controller.js` + `error.middleware.js` |
| Soft delete (opcional) | `deletedAt`, `remover` e `restaurar` no service |
| Aparência profissional | Painel React responsivo com design system próprio |
| Git com commits incrementais | Histórico separado por backend, frontend e documentação |

---

## 9. Roteiro de defesa (5 minutos)

1. **Abrir o painel** em `http://localhost:5173` e mostrar os indicadores, a busca e os filtros.
2. **Criar um pet** pelo botão “Novo pet”. Mostrar o `201` na aba Network e o toast de sucesso.
3. **Editar** o pet criado. Explicar que o `PUT` aceita atualização parcial e mescla o tutor.
4. **Arquivar** o pet. Mostrar o `204`, a saída da listagem ativa e a entrada em “Arquivados”.
5. **Restaurar** o pet. Mostrar que o registro nunca saiu do JSON (`deletedAt` voltou a `null`).
6. **Provocar um erro de validação** (telefone inválido ou campo vazio). Mostrar o `400` com `errors[].field`.
7. **Abrir o código** e percorrer o fluxo `routes → controller → service → model → db.js`.
8. **Mostrar o handler centralizado** e explicar por que os erros nascem em um só lugar.
9. **Concluir** com a persistência JSON, a fila de escrita e a possibilidade de trocar o model por outro banco sem alterar controller/service.

---

## 10. Estratégia de commits

O histórico foi organizado em commits pequenos e temáticos:

```text
chore: configura workspaces npm e scripts de desenvolvimento
feat(backend): cria API REST de pets em camadas com persistencia JSON, zod e soft delete
feat(frontend): implementa painel PetCare com busca, filtros, formulario, arquivados e ficha do pet
docs: documenta arquitetura, endpoints, validacao, soft delete e roteiro de defesa
```

Para conferir:

```bash
git log --oneline
git status
```

---

## 11. Observações

- O projeto não usa MongoDB; a persistência é local em JSON, conforme a etapa inicial da atividade.
- O arquivo `backend/data/pets.json` é versionado de propósito, para que a base de demonstração esteja disponível em qualquer máquina.
- `node_modules/`, `frontend/dist/` e arquivos `.env` estão no `.gitignore`.
- Repositório publicado em **https://github.com/marjoriesantos-netizen/pet-shop**.
