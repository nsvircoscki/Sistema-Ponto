const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { lerTextoCSV } = require("../lerCSV");

const fixture = (nome) => fs.readFileSync(path.join(__dirname, "fixtures", nome), "utf8");

test("CSV do CCF: colunas extras nao quebram e CCF ID/Observacao sao lidos", () => {
  const registros = lerTextoCSV(fixture("ccf-2026-10.csv"));
  assert.equal(registros.length, 6);
  assert.deepEqual(registros[0], {
    funcionario: "",
    email: "ana@empresa.com",
    entrada: "10/1/2026 8:00:00",
    saida: "10/1/2026 12:00:00",
    codigo: 0,
    ccfId: "ccf-user-ana",
    observacao: "",
  });
  assert.equal(registros[2].saida, "");
  assert.equal(registros[2].observacao, "SEM_SAIDA");
});

test("planilha do Google continua sendo lida como antes", () => {
  const registros = lerTextoCSV(fixture("planilha-2026-10.csv"));
  assert.equal(registros.length, 3);
  assert.equal(registros[0].funcionario, "101");
  assert.equal(registros[1].codigo, 2);
  assert.equal(registros[0].ccfId, null);
  // e-mail cru, como sempre foi (o cadastro local usa essa chave)
  assert.equal(registros[2].email, "Carla@Empresa.com");
});
