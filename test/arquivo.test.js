const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sis-ponto-arquivo-"));
process.env.SIS_PONTO_DB = path.join(dir, "teste.db");
process.env.FONTE_PONTOS = "arquivo";

const db = require("../database");
const { obterPontos, sha256 } = require("../fontesPontos");
const { lerTextoCSV } = require("../lerCSV");

const csvOutubro = fs.readFileSync(path.join(__dirname, "fixtures", "ccf-2026-10.csv"), "utf8");
const csvSetembro = "O,Name,Time In,Time Out,Total Hours,Hourly Wage,Total Wages,CCF ID,Observacao\n"
  + ',ana@empresa.com,9/30/2026 8:00:00,9/30/2026 12:00:00,4.00,,0,ccf-user-ana,"FALTA;PREVISTA_PENDENTE"\n';

after(() => {
  delete process.env.FONTE_PONTOS;
});

test("sem importacao, a fonte arquivo explica o que fazer", async () => {
  await assert.rejects(() => obterPontos({ mes: 10, ano: 2026 }), /Importar CSV/);
});

test("CSV importado vira os pontos do mes", async () => {
  db.salvarPontosImportados({ mes: "2026-10", csv: csvOutubro, sha256: sha256(csvOutubro), nomeArquivo: "outubro.csv", quem: "teste" });
  const pontos = await obterPontos({ mes: 10, ano: 2026 });
  assert.equal(pontos.origem, "arquivo");
  assert.equal(pontos.csv, csvOutubro);
  assert.equal(db.listarAuditoria().find((a) => a.acao === "pontos_importados").chave, "2026-10");
});

test("13o junta os meses importados do ano", async () => {
  db.salvarPontosImportados({ mes: "2026-09", csv: csvSetembro, sha256: sha256(csvSetembro), nomeArquivo: "setembro.csv", quem: "teste" });
  const registros = lerTextoCSV((await obterPontos({ ano: 2026 })).csv);
  assert.equal(registros.length, lerTextoCSV(csvOutubro).length + 1);
  const setembro = registros.find((r) => r.entrada === "9/30/2026 8:00:00");
  assert.equal(setembro.observacao, "FALTA;PREVISTA_PENDENTE");
  assert.equal(setembro.ccfId, "ccf-user-ana");
});

test("CSV separado por ponto e virgula (Excel em portugues)", () => {
  const registros = lerTextoCSV("﻿O;Name;Time In;Time Out;Total Wages\n;ana@empresa.com;10/1/2026 8:00:00;10/1/2026 12:00:00;2\n");
  assert.equal(registros[0].email, "ana@empresa.com");
  assert.equal(registros[0].saida, "10/1/2026 12:00:00");
  assert.equal(registros[0].codigo, 2);
});
