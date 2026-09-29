const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const db = new DatabaseSync(path.join(__dirname, "sis-ponto.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS app_data (
    chave TEXT PRIMARY KEY,
    dados_json TEXT NOT NULL,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

const buscarTodosStmt = db.prepare("SELECT chave, dados_json FROM app_data ORDER BY chave");
const salvarStmt = db.prepare(`
  INSERT INTO app_data (chave, dados_json, atualizado_em)
  VALUES (?, ?, CURRENT_TIMESTAMP)
  ON CONFLICT(chave) DO UPDATE SET
    dados_json = excluded.dados_json,
    atualizado_em = CURRENT_TIMESTAMP
`);

function parseJson(valor) {
  try {
    return JSON.parse(valor);
  } catch {
    return null;
  }
}

function buscarTodosDados() {
  const dados = {};
  const rows = buscarTodosStmt.all();

  for (const row of rows) {
    const valor = parseJson(row.dados_json);

    if (valor !== null) {
      dados[row.chave] = valor;
    }
  }

  return dados;
}

function salvarDado(chave, dados) {
  if (typeof chave !== "string" || chave.trim() === "") {
    throw new Error("Chave invalida para salvar dado");
  }

  salvarStmt.run(chave, JSON.stringify(dados ?? {}));
}

function salvarVariosDados(dados) {
  const entradas = Object.entries(dados || {});

  if (entradas.length === 0) {
    return;
  }

  db.exec("BEGIN");

  try {
    for (const [chave, valor] of entradas) {
      salvarDado(chave, valor);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

module.exports = {
  buscarTodosDados,
  salvarDado,
  salvarVariosDados,
};
