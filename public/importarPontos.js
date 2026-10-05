// Importacao do CSV exportado do SisCCF (FONTE_PONTOS=arquivo).
// Carregado antes do script.js; usa gerarFolha() e escaparHtml() (conferencia.js).

let fontePontosAtiva = null;

function mesAnoSelecionados() {
  const mes = Number(document.getElementById("mes")?.value);
  const ano = Number(document.getElementById("ano")?.value);
  return mes >= 1 && mes <= 12 && ano ? { mes, ano } : null;
}

// Mostra o botao so com FONTE_PONTOS=arquivo e um mes escolhido (nao em ferias/13o).
async function atualizarImportacaoPontos() {
  const caixa = document.getElementById("importarPontos");
  const status = document.getElementById("statusImportacao");
  if (!caixa) return;
  const periodo = mesAnoSelecionados();

  try {
    const res = await fetch(`/api/pontos/fonte${periodo ? `?mes=${periodo.mes}&ano=${periodo.ano}` : ""}`);
    const data = await res.json();
    fontePontosAtiva = data.fonte;
    caixa.hidden = data.fonte !== "arquivo" || !periodo;
    if (caixa.hidden) return;
    status.className = "status";
    status.textContent = data.importado
      ? `Importado: ${data.importado.nomeArquivo || "arquivo"} em ${new Date(`${data.importado.importadoEm.replace(" ", "T")}Z`).toLocaleString("pt-BR")}`
      : "Nenhum CSV importado para este mes.";
  } catch {
    caixa.hidden = true;
  }
}

// Exportacoes do Excel podem vir em Windows-1252 em vez de UTF-8.
async function lerTextoArquivo(arquivo) {
  const bytes = await arquivo.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

async function importarCsvPontos(input) {
  const arquivo = input.files?.[0];
  input.value = "";
  const periodo = mesAnoSelecionados();
  const status = document.getElementById("statusImportacao");
  if (!arquivo || !periodo) return;

  status.className = "status";
  status.textContent = `Importando ${arquivo.name}...`;
  try {
    const texto = await lerTextoArquivo(arquivo);
    const res = await fetch(`/api/pontos/importar?mes=${periodo.mes}&ano=${periodo.ano}&arquivo=${encodeURIComponent(arquivo.name)}`, {
      method: "POST",
      headers: { "Content-Type": "text/csv; charset=utf-8" },
      body: texto,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Erro ao importar");

    await atualizarImportacaoPontos();
    const outros = data.linhas - data.linhasDoMes;
    status.className = "status saved";
    status.textContent = `${arquivo.name}: ${data.linhasDoMes} registro(s) do mes importado(s)${outros ? ` (${outros} de outros meses ignorado(s) nesta folha)` : ""}.`;
    await gerarFolha();
  } catch (err) {
    status.className = "status error";
    status.textContent = err.message;
  }
}
