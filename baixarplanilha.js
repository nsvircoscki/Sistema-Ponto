const fs = require("fs");
const path = require("path");
const { obterPontos } = require("./fontesPontos");

const CAMINHO_DADOS = path.join(__dirname, "dados.csv");

// Baixa os pontos da fonte configurada (FONTE_PONTOS: planilha do Google ou
// CCF) e guarda uma copia em dados.csv. mes/ano so sao usados pelo CCF (a
// planilha sempre vem inteira).
// Retorna { csv, origem, baixadoEm, sha256 }.
async function baixarPlanilha({ mes, ano } = {}) {
  const pontos = await obterPontos({ mes, ano });

  fs.writeFileSync(CAMINHO_DADOS, pontos.csv);

  console.log(`Pontos baixados com sucesso (fonte: ${pontos.origem}).`);
  return pontos;
}

module.exports = { baixarPlanilha, CAMINHO_DADOS };
