// Fonte "sheets": a planilha do Google exportada como CSV (fluxo original).
const axios = require("axios");

async function obterCsv() {
  const url = process.env.PLANILHA_URL;

  if (!url) {
    throw new Error("PLANILHA_URL nao definida. Configure o arquivo .env (veja .env.example).");
  }

  const response = await axios.get(url, { responseType: "text" });
  return String(response.data);
}

// A planilha nao tem relatorio de pendencias do lado de la.
async function obterPendencias() {
  return null;
}

module.exports = { obterCsv, obterPendencias };
