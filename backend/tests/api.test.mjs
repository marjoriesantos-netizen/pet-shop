import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.API_URL || "http://localhost:3000";
const DB_FILE = fileURLToPath(new URL("../data/pets.json", import.meta.url));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let createdId = null;

const request = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return { status: response.status, data };
};

const assert = (condition, label, extra) => {
  if (!condition) {
    throw new Error(`${label}${extra ? ` — ${JSON.stringify(extra)}` : ""}`);
  }

  console.log(`PASS ${label}`);
};

const waitForApi = async () => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const health = await request("/health");
      if (health.status === 200) {
        return health;
      }
    } catch {
      // A API ainda pode estar subindo.
    }

    await sleep(500);
  }

  throw new Error(
    `A API não respondeu em ${BASE_URL}. Inicie com "npm run dev:backend".`,
  );
};

const run = async () => {
  const health = await waitForApi();
  assert(health.status === 200, "GET /health responde 200");
  assert(health.data.database === "json", "Health confirma persistência JSON");
  assert(typeof health.data.pets === "number", "Health informa a quantidade de pets");

  const active = await request("/pets");
  assert(active.status === 200 && Array.isArray(active.data), "GET /pets responde uma lista");

  const all = await request("/pets?includeDeleted=true");
  assert(
    all.status === 200 && Array.isArray(all.data),
    "GET /pets?includeDeleted=true responde uma lista",
  );
  assert(all.data.length >= active.data.length, "Listagem completa inclui os arquivados");

  const initialActive = active.data.length;

  const empty = await request("/pets", { method: "POST", body: "{}" });
  assert(empty.status === 400, "POST vazio responde 400", empty);
  assert(empty.data.errors?.length >= 2, "POST vazio devolve erros por campo", empty.data);

  const invalid = await request("/pets", {
    method: "POST",
    body: JSON.stringify({
      name: "A",
      species: "dinossauro",
      size: "gigante",
      birthDate: "2030-01-01",
      tutor: { name: "B", phone: "123" },
    }),
  });
  assert(invalid.status === 400, "POST com dados inválidos responde 400", invalid);
  assert(
    invalid.data.errors?.some((error) => error.field === "tutor.phone"),
    "Validação aponta o telefone do tutor",
    invalid.data,
  );

  const created = await request("/pets", {
    method: "POST",
    body: JSON.stringify({
      name: "Bolinha QA",
      species: "cao",
      breed: "SRD",
      size: "pequeno",
      birthDate: "2024-01-15",
      tutor: {
        name: "QA Tutor",
        phone: "(67) 99999-0000",
        email: "qa@email.com",
      },
      notes: "Pet criado pelo teste automatizado.",
    }),
  });
  assert(created.status === 201, "POST válido responde 201", created);
  assert(created.data.id && created.data.deletedAt === null, "POST devolve id e deletedAt nulo");

  createdId = created.data.id;

  const detail = await request(`/pets/${createdId}`);
  assert(detail.status === 200 && detail.data.id === createdId, "GET /pets/:id retorna o detalhe");

  const activeAfterCreate = await request("/pets");
  assert(
    activeAfterCreate.data.length === initialActive + 1,
    "POST adiciona um pet à listagem ativa",
  );

  const updated = await request(`/pets/${createdId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: "Bolinha QA Atualizado",
      tutor: { phone: "(67) 98888-1111" },
    }),
  });
  assert(updated.status === 200, "PUT responde 200", updated);
  assert(updated.data.name === "Bolinha QA Atualizado", "PUT atualiza o nome");
  assert(
    updated.data.tutor.name === "QA Tutor",
    "PUT preserva campos não enviados do tutor",
  );

  const emptyPut = await request(`/pets/${createdId}`, {
    method: "PUT",
    body: "{}",
  });
  assert(emptyPut.status === 400, "PUT vazio responde 400", emptyPut);

  const removed = await request(`/pets/${createdId}`, { method: "DELETE" });
  assert(removed.status === 204, "DELETE responde 204", removed);

  const afterDelete = await request(`/pets/${createdId}`);
  assert(afterDelete.status === 404, "Pet arquivado não aparece no detalhe (404)");

  const activeAfterDelete = await request("/pets");
  assert(
    activeAfterDelete.data.length === initialActive,
    "Soft delete remove da listagem ativa",
  );

  const allAfterDelete = await request("/pets?includeDeleted=true");
  assert(
    allAfterDelete.data.some((pet) => pet.id === createdId && pet.deletedAt),
    "Soft delete mantém o pet na listagem completa",
  );

  const restored = await request(`/pets/${createdId}/restore`, {
    method: "POST",
  });
  assert(
    restored.status === 200 && restored.data.deletedAt === null,
    "Restore responde 200",
    restored,
  );

  const removedAgain = await request(`/pets/${createdId}`, { method: "DELETE" });
  assert(removedAgain.status === 204, "DELETE do pet restaurado responde 204");

  const unknown = await request("/rota-inexistente");
  assert(unknown.status === 404, "Rota inexistente responde 404", unknown);

  const malformed = await fetch(`${BASE_URL}/pets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ isso não é json",
  });
  assert(malformed.status === 400, "JSON malformado responde 400");

  const unknownField = await request("/pets", {
    method: "POST",
    body: JSON.stringify({
      name: "Teste",
      species: "cao",
      size: "pequeno",
      tutor: { name: "Teste", phone: "(67) 99999-0000" },
      campoExtra: true,
    }),
  });
  assert(unknownField.status === 400, "Campo desconhecido responde 400 (strict)");

  const missing = await request("/pets/00000000-0000-4000-8000-000000000000", {
    method: "DELETE",
  });
  assert(missing.status === 404, "DELETE de id inexistente responde 404");

  console.log("\nTodos os testes da API passaram.");
};

run()
  .catch((error) => {
    console.error(`\nFALHA: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!createdId) {
      return;
    }

    try {
      const raw = await readFile(DB_FILE, "utf8");
      const pets = JSON.parse(raw);
      const filtered = pets.filter((pet) => pet.id !== createdId);

      if (filtered.length === pets.length) {
        return;
      }

      await writeFile(DB_FILE, `${JSON.stringify(filtered, null, 2)}\n`, "utf8");
      console.log("Pet de teste removido do banco.");
    } catch (error) {
      console.error(`Não foi possível remover o pet de teste: ${error.message}`);
      process.exitCode = 1;
    }
  });
