const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

// Colunas lidas pelo NOME do cabecalho: colunas extras sao ignoradas.
//   Planilha do Google: O, Name (e-mail), Time In, Time Out, ..., Total Wages (codigo de ocorrencia)
//   CCF: as mesmas + "CCF ID" (id do funcionario no CCF) e "Observacao"
//        (SEM_SAIDA, SEM_ENTRADA, INCONSISTENTE:...)
function lerTextoCSV(texto) {
  const registros = parse(texto, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });

  return registros.map((row) => ({
    funcionario: row["Funcionario"] || row["O"] || "",
    email: row["Email"] || row["Name"],
    entrada: row["Entrada"] || row["Time In"],
    saida: row["Saída"] || row["Time Out"],
    codigo: Number(row["Codigo"] || row["Total Wages"] || 0),
    ccfId: row["CCF ID"] || null,
    observacao: row["Observacao"] || "",
  }));
}

function lerCSV(caminho = path.join(__dirname, "dados.csv")) {
  return lerTextoCSV(fs.readFileSync(caminho));
}

module.exports = { lerCSV, lerTextoCSV };
