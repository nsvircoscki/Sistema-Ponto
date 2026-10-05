// Conferencia antes de fechar a folha + conciliacao de funcionarios do CCF.
// Carregado antes do script.js; usa carregarFuncionarios() e gerarFolha() dele.

let conferenciaAtual = null;
// "Usar dados atuais": a proxima geracao ignora a copia da folha fechada.
let usarDadosAtuaisNaProximaFolha = false;

const ROTULOS_PENDENCIA = {
  SEM_SAIDA: "Entrada sem saida",
  SEM_ENTRADA: "Saida sem entrada",
  SEM_EMAIL: "Linha sem funcionario",
  ENTRADA_INVALIDA: "Data de entrada invalida",
  SAIDA_INVALIDA: "Data de saida invalida",
  SAIDA_ANTES_DA_ENTRADA: "Saida antes da entrada",
  "INCONSISTENTE:ENTRADA_SEGUIDA": "Duas entradas seguidas (CCF)",
  "INCONSISTENTE:SAIDA_SEM_ENTRADA": "Saida fora de sequencia (CCF)",
  PREVISTA_PENDENTE: "Esqueceu de bater: aguardando o ENG abonar ou marcar falta (CCF)",
};

function escaparHtml(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function carregarConferencia(mes, ano) {
  const caixa = document.getElementById("conferencia");
  if (!caixa) return;
  conferenciaAtual = null;
  caixa.innerHTML = '<p class="status">Conferindo pendencias...</p>';
  try {
    const res = await fetch(`/conferencia?mes=${mes}&ano=${ano}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.erro || "Erro na conferencia");
    conferenciaAtual = data;
  } catch (err) {
    conferenciaAtual = { erro: err.message };
  }
  renderizarConferencia();
}

function dispositivosComPendencia(ccf) {
  return (ccf?.dispositivos || []).filter((d) => Number(d.pendentes) > 0);
}

// Texto curto para o confirm() de fechamento; vazio = nada pendente.
function resumoPendenciasConferencia() {
  const c = conferenciaAtual;
  if (!c) return "- A conferencia ainda nao terminou de carregar";
  if (c.erro) return `- Conferencia nao carregou: ${c.erro}`;
  const linhas = [];
  if (c.naoConciliados?.length) linhas.push(`- ${c.naoConciliados.length} funcionario(s) do CCF sem vinculo (pontos fora da folha)`);
  if (c.pendenciasRegistros?.length) linhas.push(`- ${c.pendenciasRegistros.length} registro(s) de ponto com problema (sem saida, inconsistente...)`);
  if (c.semSalario?.length) linhas.push(`- ${c.semSalario.length} funcionario(s) com salario zerado no cadastro`);
  if (c.alteracaoAposFechamento?.mudou) linhas.push("- Os pontos mudaram na fonte depois do ultimo fechamento");
  const dispositivos = dispositivosComPendencia(c.ccf);
  if (dispositivos.length) linhas.push(`- ${dispositivos.length} aparelho(s) ainda com pontos nao enviados ao CCF`);
  if (c.ccf?.erro) linhas.push(`- Pendencias do CCF nao carregaram: ${c.ccf.erro}`);
  return linhas.join("\n");
}

function opcoesFuncionariosLocais(sugestao) {
  const funcionarios = carregarFuncionarios();
  const emails = Object.keys(funcionarios).sort((a, b) => (funcionarios[a].nome || a).localeCompare(funcionarios[b].nome || b));
  return ['<option value="">Escolha o cadastro local...</option>']
    .concat(emails.map((email) => `<option value="${escaparHtml(email)}"${email === sugestao ? " selected" : ""}>${escaparHtml(funcionarios[email].nome || email)} (${escaparHtml(email)})</option>`))
    .join("");
}

function renderizarConferencia() {
  const caixa = document.getElementById("conferencia");
  const c = conferenciaAtual;
  if (!caixa || !c) return;
  if (c.erro) {
    caixa.innerHTML = `<div class="conferencia"><p class="status error">Conferencia indisponivel: ${escaparHtml(c.erro)}</p></div>`;
    return;
  }

  const partes = [];
  const fonte = { ccf: "CCF", arquivo: "CSV importado do SisCCF" }[c.origem] || "Planilha do Google";
  partes.push(`<p class="conferencia-fonte">Pontos: <b>${fonte}</b>${c.baixadoEm ? ` · obtidos em ${new Date(c.baixadoEm).toLocaleString("pt-BR")}` : ""}</p>`);

  if (c.usandoCopiaDaFolhaFechada) {
    partes.push(`<p class="status">Folha fechada em ${escaparHtml(c.fechamento?.fechadoEm)}${c.fechamento?.fechadoPor ? ` por ${escaparHtml(c.fechamento.fechadoPor)}` : ""}: usando a copia dos pontos gravada no fechamento.</p>`);
  }
  if (c.alteracaoAposFechamento?.mudou) {
    partes.push(`<p class="status error">Os pontos mudaram na fonte depois do fechamento (+${c.alteracaoAposFechamento.adicionadas} / -${c.alteracaoAposFechamento.removidas} linhas).
      <button type="button" class="secondary-button" onclick="usarDadosAtuaisDaFonte()">Usar dados atuais</button></p>`);
  } else if (c.alteracaoAposFechamento?.erro) {
    partes.push(`<p class="status">Nao foi possivel comparar com a fonte: ${escaparHtml(c.alteracaoAposFechamento.erro)}</p>`);
  }

  if (c.naoConciliados?.length) {
    const comSugestao = c.naoConciliados.filter((n) => n.sugestaoEmailLocal).length;
    partes.push(`<h3>Funcionarios do CCF sem vinculo (${c.naoConciliados.length})</h3>
      <p class="status">Os pontos deles <b>nao entram na folha</b> ate serem vinculados a um cadastro local.</p>
      ${comSugestao ? `<button type="button" onclick="vincularTodasSugestoes()">Vincular as ${comSugestao} sugestoes por e-mail</button>` : ""}
      <table class="conferencia-tabela"><tbody>
      ${c.naoConciliados.map((n, i) => `<tr>
        <td>${escaparHtml(n.emailCcf || n.ccfId)}<br><small>CCF ID ${escaparHtml(n.ccfId)} · ${n.linhas} registro(s)</small></td>
        <td><select id="vinculo-${i}">${opcoesFuncionariosLocais(n.sugestaoEmailLocal)}</select></td>
        <td><button type="button" onclick="vincularFuncionarioCcf(${i})">Vincular</button></td>
      </tr>`).join("")}
      </tbody></table>`);
  }

  if (c.pendenciasRegistros?.length) {
    const mostrar = c.pendenciasRegistros.slice(0, 100);
    partes.push(`<h3>Registros a conferir (${c.pendenciasRegistros.length})</h3>
      <table class="conferencia-tabela"><thead><tr><th>Funcionario</th><th>Entrada</th><th>Saida</th><th>Problema</th></tr></thead><tbody>
      ${mostrar.map((p) => `<tr><td>${escaparHtml(p.email)}</td><td>${escaparHtml(p.entrada || "-")}</td><td>${escaparHtml(p.saida || "-")}</td>
        <td>${p.motivos.map((m) => escaparHtml(ROTULOS_PENDENCIA[m] || m)).join(", ")}</td></tr>`).join("")}
      </tbody></table>${c.pendenciasRegistros.length > mostrar.length ? `<p class="status">... e mais ${c.pendenciasRegistros.length - mostrar.length}.</p>` : ""}`);
  }

  if (c.semSalario?.length) {
    partes.push(`<h3>Salario zerado no cadastro (${c.semSalario.length})</h3><p class="status error">${c.semSalario.map(escaparHtml).join(", ")}</p>`);
  }

  if (c.ccf) {
    if (c.ccf.erro) {
      partes.push(`<p class="status error">Pendencias do CCF: ${escaparHtml(c.ccf.erro)}</p>`);
    } else {
      const dispositivos = dispositivosComPendencia(c.ccf);
      const atrasadas = c.ccf.sincronizadasComAtraso?.length || 0;
      partes.push(`<h3>Aparelhos de ponto</h3>
        <p class="status${dispositivos.length ? " error" : ""}">${dispositivos.length
          ? `${dispositivos.length} aparelho(s) ainda tinham pontos nao enviados no ultimo contato: ${dispositivos.map((d) => `${d.pendentes} (visto em ${new Date(d.ultimoContato).toLocaleString("pt-BR")})`).join("; ")}.`
          : "Nenhum aparelho com pontos pendentes no ultimo contato."}
        ${atrasadas ? ` ${atrasadas} batida(s) do mes chegaram com mais de 1h de atraso (offline).` : ""}</p>`);
    }
  }

  const tudoCerto = !resumoPendenciasConferencia();
  caixa.innerHTML = `<div class="conferencia ${tudoCerto ? "ok" : ""}"><h2>Conferencia</h2>${tudoCerto ? '<p class="status saved">Nenhuma pendencia para este mes.</p>' : ""}${partes.join("")}</div>`;
}

async function enviarVinculo(ccfId, emailLocal, emailCcf) {
  const res = await fetch("/api/vinculos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ccfId, emailLocal, emailCcf }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).erro || "Erro ao vincular");
}

async function vincularFuncionarioCcf(indice) {
  const item = conferenciaAtual?.naoConciliados?.[indice];
  const emailLocal = document.getElementById(`vinculo-${indice}`)?.value;
  if (!item || !emailLocal) {
    alert("Escolha o cadastro local antes de vincular.");
    return;
  }
  try {
    await enviarVinculo(item.ccfId, emailLocal, item.emailCcf);
    await gerarFolha();
  } catch (err) {
    alert(err.message);
  }
}

async function vincularTodasSugestoes() {
  const itens = (conferenciaAtual?.naoConciliados || []).filter((n) => n.sugestaoEmailLocal);
  if (!itens.length || !confirm(`Vincular ${itens.length} funcionario(s) do CCF ao cadastro local de mesmo e-mail?`)) return;
  try {
    for (const item of itens) await enviarVinculo(item.ccfId, item.sugestaoEmailLocal, item.emailCcf);
    await gerarFolha();
  } catch (err) {
    alert(err.message);
  }
}

function usarDadosAtuaisDaFonte() {
  if (!confirm("Gerar a folha com os pontos atuais da fonte, em vez da copia do fechamento? Para valer, salve a folha de novo depois de conferir.")) return;
  usarDadosAtuaisNaProximaFolha = true;
  gerarFolha();
}

// Grava no banco local a copia dos pontos usados nesta folha.
async function registrarFechamentoFolha(chave) {
  try {
    const res = await fetch(`/api/folhas/${encodeURIComponent(chave)}/fechar`, { method: "POST" });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).erro || "Erro ao gravar a copia dos pontos");
  } catch (err) {
    document.getElementById("resultado")?.insertAdjacentHTML("afterbegin", `<p class="status error">Folha salva, mas a copia dos pontos nao foi gravada: ${escaparHtml(err.message)}</p>`);
  }
}
