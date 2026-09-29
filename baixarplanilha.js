const axios = require("axios");
const fs = require("fs");
const path = require("path");

try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {
  // Sem .env: usa apenas as variaveis de ambiente do sistema
}

async function baixarPlanilha() {
  const url = process.env.PLANILHA_URL;

  if (!url) {
    throw new Error("PLANILHA_URL nao definida. Configure o arquivo .env (veja .env.example).");
  }

  const response = await axios.get(url);

  fs.writeFileSync("./dados.csv", response.data);

  console.log("Planilha baixada com sucesso!");
}

module.exports = { baixarPlanilha };
