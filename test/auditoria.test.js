const { test } = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");

// Banco temporario: nunca toca no sis-ponto.db real.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sis-ponto-test-"));
process.env.SIS_PONTO_DB = path.join(dir, "teste.db");
process.env.OPERADOR_FOLHA = "teste";

const { diffAuditoria } = require("../auditoria");
const db = require("../database");

test("diff de salario registra antigo e novo; campo nao monetario nao entra", () => {
  const entradas = diffAuditoria("sis-ponto-funcionarios",
    { "a@b.com": { salario: 20, cargo: "x" } },
    { "a@b.com": { salario: 25, cargo: "y" } });
  assert.deepEqual(entradas, [{ quem: "teste", acao: "funcionario.salario", chave: "a@b.com", valorAntigo: 20, valorNovo: 25 }]);
});

test("desconto alterado e folha apagada entram no log", () => {
  assert.equal(diffAuditoria("sis-ponto-descontos", { "2026-10-a@b.com": { vale: 10 } }, { "2026-10-a@b.com": { vale: 15 } }).length, 1);
  const apagada = diffAuditoria("sis-ponto-historico-folhas", { "2026-10": { salvoEm: "x" } }, {});
  assert.equal(apagada[0].acao, "historico.apagado");
});

test("salvar com auditoria grava o dado e o log juntos", () => {
  const chave = "sis-ponto-funcionarios";
  const novo = { "a@b.com": { salario: 30 } };
  db.salvarDadoComAuditoria(chave, novo, diffAuditoria(chave, db.buscarDado(chave), novo));
  assert.equal(db.buscarDado(chave)["a@b.com"].salario, 30);
  const log = db.listarAuditoria();
  assert.equal(log[0].acao, "funcionario.salario");
  assert.equal(log[0].valor_novo, "30");
});

test("vinculo e fechamento ficam no banco e na auditoria", () => {
  db.salvarVinculo({ ccfId: "ccf-1", emailLocal: "a@b.com", emailCcf: "a@ccf.com", quem: "teste" });
  assert.equal(db.listarVinculos()["ccf-1"].email_local, "a@b.com");
  db.salvarFechamento({ mes: "2026-10", origem: "ccf", csv: "O,Name\n", sha256: "abc", quem: "teste" });
  assert.equal(db.buscarFechamento("2026-10").csv, "O,Name\n");
  const acoes = db.listarAuditoria().map((l) => l.acao);
  assert.ok(acoes.includes("vinculo_ccf"));
  assert.ok(acoes.includes("folha_fechada"));
});
