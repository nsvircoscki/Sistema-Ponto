// Fonte "arquivo": CSV exportado do SisCCF e importado pela tela (botao
// "Importar CSV" na aba Folha). Fica no banco local, um arquivo por mes.
// Nada e buscado na rede.
const { parse } = require("csv-parse/sync");
const { detectarSeparador } = require("../lerCSV");

// O banco so e aberto quando a fonte e usada (os testes das outras fontes
// nao precisam dele).
const banco = () => require("../database");

const nomeMes = (mes, ano) => `${String(mes).padStart(2, "0")}/${ano}`;

function campoCsv(valor) {
  const texto = String(valor ?? "");
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

// Junta os CSVs de varios meses num so (13o salario). As colunas sao a uniao
// dos cabecalhos; linhas repetidas entre arquivos entram uma vez so.
function juntarCsvs(textos) {
  const colunas = [];
  const linhas = new Map();

  textos.forEach((texto) => {
    parse(texto, { columns: true, skip_empty_lines: true, bom: true, delimiter: detectarSeparador(texto) }).forEach((row) => {
      Object.keys(row).forEach((coluna) => {
        if (!colunas.includes(coluna)) colunas.push(coluna);
      });
      linhas.set(JSON.stringify(Object.entries(row)), row);
    });
  });

  return [colunas, ...[...linhas.values()].map((row) => colunas.map((c) => row[c]))]
    .map((linha) => linha.map(campoCsv).join(","))
    .join("\n") + "\n";
}

async function obterCsv({ mes, ano }) {
  if (mes) {
    const importado = banco().buscarPontosImportados(`${ano}-${String(mes).padStart(2, "0")}`);
    if (!importado) {
      throw new Error(`Nenhum relatorio de pontos importado para ${nomeMes(mes, ano)}. Use "Importar CSV" na aba Folha.`);
    }
    return importado.csv;
  }

  const doAno = banco().listarPontosImportadosDoAno(ano);
  if (!doAno.length) {
    throw new Error(`Nenhum relatorio de pontos importado em ${ano}. Use "Importar CSV" na aba Folha.`);
  }
  return juntarCsvs(doAno.map((item) => item.csv));
}

// O arquivo exportado nao traz as pendencias dos aparelhos.
async function obterPendencias() {
  return null;
}

module.exports = { obterCsv, obterPendencias, juntarCsvs };
