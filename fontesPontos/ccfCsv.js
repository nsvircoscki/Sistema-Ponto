// Fonte "ccf": CSV de pontos exportado pelo CCF (so pontos, sem salario).
//   CCF_PONTO_URL=https://ccf.seudominio.com.br/api/sis-ponto
//   CCF_EXPORT_TOKEN=<token configurado no CCF em PONTO_EXPORT_TOKENS>
// O PC da folha so BUSCA dados no CCF; nada aqui precisa estar acessivel de fora.
const axios = require("axios");

function configuracao() {
  const base = String(process.env.CCF_PONTO_URL || "").replace(/\/+$/, "");
  const token = process.env.CCF_EXPORT_TOKEN;

  if (!base || !token) {
    throw new Error("CCF_PONTO_URL e CCF_EXPORT_TOKEN precisam estar no .env para usar FONTE_PONTOS=ccf.");
  }

  return { base, headers: { Authorization: `Bearer ${token}` } };
}

// mes (1-12) e ano -> ?mes=YYYY-MM; so ano -> ?ano=YYYY (13o salario)
function periodo({ mes, ano }) {
  if (mes) return { mes: `${ano}-${String(mes).padStart(2, "0")}` };
  return { ano: String(ano) };
}

function mensagemErro(err, oQue) {
  const status = err.response?.status;
  if (status === 401) return `CCF recusou o token ao buscar ${oQue}. Confira CCF_EXPORT_TOKEN.`;
  if (status === 503) return `Export de pontos desligado no CCF (PONTO_EXPORT_TOKENS nao configurado).`;
  if (status) return `CCF respondeu ${status} ao buscar ${oQue}.`;
  return `Nao foi possivel conectar ao CCF para buscar ${oQue}: ${err.message}`;
}

async function obterCsv({ mes, ano }) {
  const { base, headers } = configuracao();
  try {
    const response = await axios.get(`${base}/export.csv`, { headers, params: periodo({ mes, ano }), responseType: "text", timeout: 30000 });
    return String(response.data);
  } catch (err) {
    throw new Error(mensagemErro(err, "os pontos"));
  }
}

async function obterPendencias({ mes, ano }) {
  const { base, headers } = configuracao();
  try {
    const response = await axios.get(`${base}/export-pendencias.json`, { headers, params: periodo({ mes, ano }), timeout: 30000 });
    return response.data;
  } catch (err) {
    return { erro: mensagemErro(err, "as pendencias") };
  }
}

module.exports = { obterCsv, obterPendencias };
