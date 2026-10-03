const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { lerTextoCSV } = require("../lerCSV");
const { resolverRegistros } = require("../conciliacao");

const registros = lerTextoCSV(fs.readFileSync(path.join(__dirname, "fixtures", "ccf-2026-10.csv"), "utf8"));
const funcionariosLocais = {
  "ana.silva@pessoal.com": { nome: "Ana", salario: 20 },
  "Bruno@Empresa.com": { nome: "Bruno", salario: 30 },
};

test("vinculado por ID usa o cadastro local, mesmo com e-mail diferente no CCF", () => {
  const vinculos = { "ccf-user-ana": { email_local: "ana.silva@pessoal.com" } };
  const { resolvidos } = resolverRegistros(registros, vinculos, funcionariosLocais);
  const daAna = resolvidos.filter((r) => r.ccfId === "ccf-user-ana");
  assert.equal(daAna.length, 3);
  assert.ok(daAna.every((r) => r.email === "ana.silva@pessoal.com"));
});

test("nao conciliado vira pendencia (nao entra na folha), com sugestao por e-mail", () => {
  const vinculos = { "ccf-user-ana": { email_local: "ana.silva@pessoal.com" } };
  const { resolvidos, naoConciliados } = resolverRegistros(registros, vinculos, funcionariosLocais);
  assert.equal(resolvidos.some((r) => r.ccfId === "ccf-user-bruno"), false);
  assert.deepEqual(naoConciliados.map((n) => n.ccfId).sort(), ["ccf-user-bruno", "ccf-user-novo"]);
  const bruno = naoConciliados.find((n) => n.ccfId === "ccf-user-bruno");
  assert.equal(bruno.linhas, 2);
  // a sugestao ignora maiusculas, mas devolve a chave local exata
  assert.equal(bruno.sugestaoEmailLocal, "Bruno@Empresa.com");
  assert.equal(naoConciliados.find((n) => n.ccfId === "ccf-user-novo").sugestaoEmailLocal, null);
});

test("linha sem CCF ID (planilha) passa direto pelo e-mail", () => {
  const { resolvidos, naoConciliados } = resolverRegistros([{ email: "x@y.com", entrada: "1/1/2026 8:00:00" }], {}, {});
  assert.equal(resolvidos.length, 1);
  assert.equal(naoConciliados.length, 0);
});
