const fs = require("fs");
const { parse } = require("csv-parse/sync");

function lerCSV(caminho = "./dados.csv") {
  const file = fs.readFileSync(caminho);

  const registros = parse(file, {
    columns: true,
    skip_empty_lines: true,
  });

  return registros.map((row) => ({
    funcionario: row["Funcionario"] || row["O"] || "",
    email: row["Email"] || row["Name"],
    entrada: row["Entrada"] || row["Time In"],
    saida: row["Saída"] || row["Time Out"],
    codigo: Number(row["Codigo"] || row["Total Wages"] || 0),
  }));
}

module.exports = { lerCSV };
