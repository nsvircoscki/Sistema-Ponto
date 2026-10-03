const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { lerTextoCSV } = require("../lerCSV");
const { calcularHoras, listarPendenciasRegistros } = require("../calculo");
const { resolverRegistros } = require("../conciliacao");
const CalculoFolha = require("../public/calculoFolha");

const fixture = (nome) => lerTextoCSV(fs.readFileSync(path.join(__dirname, "fixtures", nome), "utf8"));

test("pontos sem saida e inconsistentes do CCF aparecem como pendencia", () => {
  const pendencias = listarPendenciasRegistros(fixture("ccf-2026-10.csv"), 10, 2026);
  assert.equal(pendencias.length, 3);
  assert.deepEqual(pendencias.map((p) => p.motivos), [["SEM_SAIDA"], ["SEM_SAIDA"], ["INCONSISTENTE:ENTRADA_SEGUIDA"]]);
});

test("saida sem entrada nao some (antes era descartada em silencio)", () => {
  const pendencias = listarPendenciasRegistros([{ email: "a@b.com", entrada: "", saida: "10/3/2026 12:00:00", observacao: "SEM_ENTRADA" }], 10, 2026);
  assert.equal(pendencias.length, 1);
  assert.deepEqual(pendencias[0].motivos, ["SEM_ENTRADA"]);
});

test("Total Wages: horas do CSV do CCF x valor da hora LOCAL", () => {
  const funcionariosLocais = { "ana@empresa.com": { tipo: "horista", salario: 25 } };
  const vinculos = { "ccf-user-ana": { email_local: "ana@empresa.com" } };
  const { resolvidos } = resolverRegistros(fixture("ccf-2026-10.csv"), vinculos, funcionariosLocais);
  const folha = calcularHoras(resolvidos, 10, 2026)["ana@empresa.com"];

  const horas = CalculoFolha.horasTotaisRegistros(folha);
  assert.equal(horas, 8.5); // 4h + 4h30; a entrada sem saida conta 0h e vai para a conferencia
  const salario = CalculoFolha.salarioDoMes({ tipo: "horista", salarioBase: funcionariosLocais["ana@empresa.com"].salario, horas });
  assert.equal(salario, 212.5);
});

test("Hourly Wage do CSV e ignorado (planilha com 999)", () => {
  const folha = calcularHoras(fixture("planilha-2026-10.csv"), 10, 2026)["ana@empresa.com"];
  const horas = CalculoFolha.horasTotaisRegistros(folha);
  assert.equal(horas, 8);
  assert.equal(CalculoFolha.salarioDoMes({ tipo: "horista", salarioBase: 10, horas }), 80);
  // na planilha, o codigo de ocorrencia continua vindo de Total Wages
  assert.equal(folha.atestados, 1);
});

test("mensalista recebe o salario mensal calculado localmente", () => {
  assert.equal(CalculoFolha.salarioDoMes({ tipo: "mensalista", salarioBase: 3000, horas: 1, salarioMensalista: 3000 }), 3000);
});
