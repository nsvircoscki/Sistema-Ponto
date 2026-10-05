const { test } = require("node:test");
const assert = require("node:assert/strict");
const { lerTextoCSV } = require("../lerCSV");
const { calcularHoras, listarPendenciasRegistros } = require("../calculo");

// Linhas como o CCF exporta quando a pessoa esqueceu de bater (horario
// previsto) e o ENG decidiu: abonou, marcou falta, ou ainda nao decidiu.
const csv = [
  "O,Name,Time In,Time Out,Total Hours,Hourly Wage,Total Wages,CCF ID,Observacao",
  ",a@b.com,10/1/2026 8:00:00,10/1/2026 12:00:00,4.00,,0,u1,",
  ",a@b.com,10/1/2026 13:00:00,10/1/2026 18:00:00,5.00,,0,u1,PREVISTA_ABONADA",
  ",a@b.com,10/2/2026 8:00:00,10/2/2026 12:00:00,0.00,,6,u1,FALTA",
  ",a@b.com,10/5/2026 13:00:00,10/5/2026 18:00:00,0.00,,0,u1,PREVISTA_PENDENTE",
].join("\r\n");

test("abonada conta horas; falta e pendente nao contam", () => {
  const folha = calcularHoras(lerTextoCSV(csv), 10, 2026)["a@b.com"];
  assert.equal(folha.horas, 9);
  assert.deepEqual(folha.registros.map((r) => r.horas), [4, 5, 0, 0]);
});

test("falta entra como falta (codigo 6) e desconta beneficio", () => {
  const folha = calcularHoras(lerTextoCSV(csv), 10, 2026)["a@b.com"];
  assert.equal(folha.faltas, 1);
  assert.equal(folha.descontoBeneficios, 1);
});

test("so o previsto sem decisao vira pendencia na conferencia", () => {
  const pendencias = listarPendenciasRegistros(lerTextoCSV(csv), 10, 2026);
  assert.deepEqual(pendencias.map((p) => p.motivos), [["PREVISTA_PENDENTE"]]);
});
