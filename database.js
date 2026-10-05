const path = require("path");
const { DatabaseSync } = require("node:sqlite");

// SIS_PONTO_DB permite apontar para outro arquivo (usado pelos testes).
const db = new DatabaseSync(process.env.SIS_PONTO_DB || path.join(__dirname, "sis-ponto.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS app_data (
    chave TEXT PRIMARY KEY,
    dados_json TEXT NOT NULL,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// Vinculo funcionario do CCF (id) -> cadastro local (e-mail, chave de
// sis-ponto-funcionarios). Por ID, nunca por nome.
db.exec(`
  CREATE TABLE IF NOT EXISTS vinculo_ccf (
    ccf_id TEXT PRIMARY KEY,
    email_local TEXT NOT NULL,
    email_ccf TEXT,
    vinculado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vinculado_por TEXT
  )
`);

// Copia dos pontos usados em cada folha fechada (mes = "YYYY-MM"). Correcoes
// feitas depois no CCF nao mudam a folha fechada sem aviso.
db.exec(`
  CREATE TABLE IF NOT EXISTS folha_fechamento (
    mes TEXT PRIMARY KEY,
    origem TEXT NOT NULL,
    csv TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    baixado_em TEXT,
    fechado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fechado_por TEXT
  )
`);

// CSV de pontos importado pela tela (FONTE_PONTOS=arquivo), um por mes
// ("YYYY-MM"). Importar de novo o mesmo mes substitui o anterior.
db.exec(`
  CREATE TABLE IF NOT EXISTS pontos_importados (
    mes TEXT PRIMARY KEY,
    csv TEXT NOT NULL,
    sha256 TEXT NOT NULL,
    nome_arquivo TEXT,
    importado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    importado_por TEXT
  )
`);

// Log de alteracoes de salario, descontos, vinculos e fechamento de folha.
db.exec(`
  CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quando TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    quem TEXT,
    acao TEXT NOT NULL,
    chave TEXT,
    valor_antigo TEXT,
    valor_novo TEXT
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

function buscarDado(chave) {
  const row = db.prepare("SELECT dados_json FROM app_data WHERE chave = ?").get(chave);
  return row ? parseJson(row.dados_json) : null;
}

const paraTexto = (valor) => (valor === undefined || valor === null ? null : (typeof valor === "string" ? valor : JSON.stringify(valor)));

function registrarAuditoria({ quem, acao, chave, valorAntigo, valorNovo }) {
  db.prepare("INSERT INTO auditoria (quem, acao, chave, valor_antigo, valor_novo) VALUES (?, ?, ?, ?, ?)")
    .run(quem || null, acao, chave || null, paraTexto(valorAntigo), paraTexto(valorNovo));
}

function listarAuditoria(limite = 200) {
  return db.prepare("SELECT * FROM auditoria ORDER BY id DESC LIMIT ?").all(Number(limite) || 200);
}

// Grava o dado e as linhas de auditoria na mesma transacao.
function salvarDadoComAuditoria(chave, dados, entradasAuditoria) {
  db.exec("BEGIN");
  try {
    salvarDado(chave, dados);
    entradasAuditoria.forEach(registrarAuditoria);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function listarVinculos() {
  const vinculos = {};
  db.prepare("SELECT * FROM vinculo_ccf").all().forEach((row) => {
    vinculos[row.ccf_id] = { ...row };
  });
  return vinculos;
}

function salvarVinculo({ ccfId, emailLocal, emailCcf, quem }) {
  if (!ccfId || !emailLocal) throw new Error("Informe o funcionario do CCF e o cadastro local.");
  const anterior = db.prepare("SELECT * FROM vinculo_ccf WHERE ccf_id = ?").get(ccfId);
  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO vinculo_ccf (ccf_id, email_local, email_ccf, vinculado_por) VALUES (?, ?, ?, ?)
      ON CONFLICT(ccf_id) DO UPDATE SET email_local = excluded.email_local, email_ccf = excluded.email_ccf,
        vinculado_em = CURRENT_TIMESTAMP, vinculado_por = excluded.vinculado_por
    `).run(ccfId, emailLocal, emailCcf || null, quem || null);
    registrarAuditoria({ quem, acao: "vinculo_ccf", chave: ccfId, valorAntigo: anterior?.email_local, valorNovo: emailLocal });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function removerVinculo(ccfId, quem) {
  const anterior = db.prepare("SELECT * FROM vinculo_ccf WHERE ccf_id = ?").get(ccfId);
  if (!anterior) return false;
  db.prepare("DELETE FROM vinculo_ccf WHERE ccf_id = ?").run(ccfId);
  registrarAuditoria({ quem, acao: "vinculo_ccf_removido", chave: ccfId, valorAntigo: anterior.email_local });
  return true;
}

function buscarFechamento(mes) {
  return db.prepare("SELECT * FROM folha_fechamento WHERE mes = ?").get(mes) || null;
}

function salvarFechamento({ mes, origem, csv, sha256, baixadoEm, quem }) {
  const anterior = buscarFechamento(mes);
  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO folha_fechamento (mes, origem, csv, sha256, baixado_em, fechado_por) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(mes) DO UPDATE SET origem = excluded.origem, csv = excluded.csv, sha256 = excluded.sha256,
        baixado_em = excluded.baixado_em, fechado_em = CURRENT_TIMESTAMP, fechado_por = excluded.fechado_por
    `).run(mes, origem, csv, sha256, baixadoEm || null, quem || null);
    registrarAuditoria({
      quem,
      acao: anterior ? "folha_refechada" : "folha_fechada",
      chave: mes,
      valorAntigo: anterior ? { origem: anterior.origem, sha256: anterior.sha256, fechadoEm: anterior.fechado_em } : null,
      valorNovo: { origem, sha256 },
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

function buscarPontosImportados(mes) {
  return db.prepare("SELECT * FROM pontos_importados WHERE mes = ?").get(mes) || null;
}

function listarPontosImportadosDoAno(ano) {
  return db.prepare("SELECT * FROM pontos_importados WHERE mes LIKE ? ORDER BY mes").all(`${ano}-%`);
}

function salvarPontosImportados({ mes, csv, sha256, nomeArquivo, quem }) {
  const anterior = buscarPontosImportados(mes);
  db.exec("BEGIN");
  try {
    db.prepare(`
      INSERT INTO pontos_importados (mes, csv, sha256, nome_arquivo, importado_por) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(mes) DO UPDATE SET csv = excluded.csv, sha256 = excluded.sha256, nome_arquivo = excluded.nome_arquivo,
        importado_em = CURRENT_TIMESTAMP, importado_por = excluded.importado_por
    `).run(mes, csv, sha256, nomeArquivo || null, quem || null);
    registrarAuditoria({
      quem,
      acao: "pontos_importados",
      chave: mes,
      valorAntigo: anterior ? { arquivo: anterior.nome_arquivo, sha256: anterior.sha256, importadoEm: anterior.importado_em } : null,
      valorNovo: { arquivo: nomeArquivo || null, sha256 },
    });
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

module.exports = {
  buscarTodosDados,
  buscarDado,
  salvarDado,
  salvarDadoComAuditoria,
  salvarVariosDados,
  registrarAuditoria,
  listarAuditoria,
  listarVinculos,
  salvarVinculo,
  removerVinculo,
  buscarFechamento,
  salvarFechamento,
  buscarPontosImportados,
  listarPontosImportadosDoAno,
  salvarPontosImportados,
};
