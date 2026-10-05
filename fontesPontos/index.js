// Camada "fonte de pontos": de onde vem o CSV de batidas da folha.
//   FONTE_PONTOS=sheets  (padrao) -> planilha do Google (PLANILHA_URL)
//   FONTE_PONTOS=ccf             -> export do CCF (CCF_PONTO_URL + CCF_EXPORT_TOKEN)
//   FONTE_PONTOS=arquivo         -> CSV do SisCCF importado pela tela (um por mes)
// Para trocar no futuro por um sync incremental (JSON), basta uma nova fonte
// com a mesma interface: obterCsv({ mes, ano }) e obterPendencias({ mes, ano }).
const crypto = require("crypto");
const path = require("path");

try {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
} catch {
  // Sem .env: usa apenas as variaveis de ambiente do sistema
}

const FONTES = {
  sheets: require("./googleSheets"),
  ccf: require("./ccfCsv"),
  arquivo: require("./arquivo"),
};

function nomeFonte() {
  const nome = String(process.env.FONTE_PONTOS || "sheets").trim().toLowerCase();
  if (!FONTES[nome]) throw new Error(`FONTE_PONTOS invalida: "${nome}". Use "sheets", "ccf" ou "arquivo".`);
  return nome;
}

const sha256 = (texto) => crypto.createHash("sha256").update(texto).digest("hex");

// -> { csv, origem, baixadoEm, sha256 }
async function obterPontos({ mes, ano } = {}) {
  const origem = nomeFonte();
  const csv = await FONTES[origem].obterCsv({ mes, ano });
  return { csv, origem, baixadoEm: new Date().toISOString(), sha256: sha256(csv) };
}

async function obterPendenciasFonte({ mes, ano } = {}) {
  return FONTES[nomeFonte()].obterPendencias({ mes, ano });
}

module.exports = { obterPontos, obterPendenciasFonte, nomeFonte, sha256 };
