const CHAVE_FUNCIONARIOS = "sis-ponto-funcionarios";
const CHAVE_DESCONTOS = "sis-ponto-descontos";
const CHAVE_HISTORICO = "sis-ponto-historico-folhas";
const CHAVE_CALENDARIOS = "sis-ponto-calendarios";
const CHAVE_REGRAS_BENEFICIOS = "sis-ponto-regras-beneficios";
const CHAVE_HORAS_PAGAS = "sis-ponto-horas-pagas";
const CHAVE_OBSERVACOES = "sis-ponto-observacoes";
const CHAVE_FERIAS = "sis-ponto-ferias";
const CHAVE_QUITACAO_FERIAS = "sis-ponto-quitacao-ferias";
const CHAVE_FERIAS_SELECIONADOS = "sis-ponto-ferias-selecionados";
const CHAVES_BANCO = [
  CHAVE_FUNCIONARIOS,
  CHAVE_DESCONTOS,
  CHAVE_HISTORICO,
  CHAVE_CALENDARIOS,
  CHAVE_REGRAS_BENEFICIOS,
  CHAVE_HORAS_PAGAS,
  CHAVE_OBSERVACOES,
  CHAVE_FERIAS,
  CHAVE_QUITACAO_FERIAS,
  CHAVE_FERIAS_SELECIONADOS,
];
const JORNADA_DIARIA = 8.8;
const JORNADA_PERIODO = JORNADA_DIARIA / 2;
const CODIGO_BANCO_HORAS = 7;
const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const FERIADOS_NACIONAIS_FIXOS = [
  { mes: 1, dia: 1, nome: "Confraternizacao Universal", desde: 1949 },
  { mes: 4, dia: 21, nome: "Tiradentes", desde: 1965 },
  { mes: 5, dia: 1, nome: "Dia Mundial do Trabalho", desde: 1949 },
  { mes: 9, dia: 7, nome: "Independencia do Brasil", desde: 1949 },
  { mes: 10, dia: 12, nome: "Nossa Senhora Aparecida", desde: 1980 },
  { mes: 11, dia: 2, nome: "Finados", desde: 2002 },
  { mes: 11, dia: 15, nome: "Proclamacao da Republica", desde: 1949 },
  { mes: 11, dia: 20, nome: "Consciencia Negra", desde: 2024 },
  { mes: 12, dia: 25, nome: "Natal", desde: 1949 },
];

let ultimaFolha = {};
let ultimaFolhaMes = "";
let ultimaFolhaAno = "";
let folhaSelecionada = "todos";
let etapaSelecaoFerias = "ida";
let feriasEmailEmEdicao = "";
let modoTabelaFerias = "ferias";
let anoFeriasSelecionado = new Date().getFullYear();
let modoFuncionarios = "ativos";
let modoDescontos = "folha";
let recibosFeriasGerados = [];
let recibosFeriasZip = null;
let mesesDecimoCache = {};
let bancoDados = {};
let bancoPronto = false;

function valorPadraoBanco(chave) {
  return chave === CHAVE_FERIAS_SELECIONADOS ? [] : {};
}

function lerLocalStorage(chave) {
  const dados = localStorage.getItem(chave);
  if (!dados) return valorPadraoBanco(chave);

  try {
    return JSON.parse(dados);
  } catch {
    return valorPadraoBanco(chave);
  }
}

async function salvarDadoBanco(chave, dados) {
  if (!bancoPronto) return;

  try {
    await fetch(`/api/dados/${encodeURIComponent(chave)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dados }),
    });
  } catch (err) {
    console.error("Nao foi possivel salvar no banco:", err);
  }
}

async function inicializarDadosBanco() {
  try {
    const res = await fetch("/api/dados");
    if (!res.ok) throw new Error("Erro ao carregar banco");

    const dadosServidor = await res.json();
    const dadosParaMigrar = {};

    CHAVES_BANCO.forEach((chave) => {
      const temServidor = Object.prototype.hasOwnProperty.call(dadosServidor, chave);
      const tinhaLocal = localStorage.getItem(chave) !== null;
      const dadosLocais = lerLocalStorage(chave);
      bancoDados[chave] = temServidor ? dadosServidor[chave] : dadosLocais;
      localStorage.setItem(chave, JSON.stringify(bancoDados[chave]));

      if (!temServidor && tinhaLocal) {
        dadosParaMigrar[chave] = dadosLocais;
      }
    });

    bancoPronto = true;

    if (Object.keys(dadosParaMigrar).length > 0) {
      await fetch("/api/dados/migrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dados: dadosParaMigrar }),
      });
    }
  } catch (err) {
    bancoPronto = false;
    bancoDados = {};
    console.error("Usando localStorage porque o banco nao carregou:", err);
  }
}

function carregarJson(chave) {
  return bancoPronto ? (bancoDados[chave] || valorPadraoBanco(chave)) : lerLocalStorage(chave);
}

function gravarJson(chave, dados) {
  bancoDados[chave] = dados;
  localStorage.setItem(chave, JSON.stringify(dados));
  salvarDadoBanco(chave, dados);
}

function carregarFuncionarios() {
  return carregarJson(CHAVE_FUNCIONARIOS);
}

function gravarFuncionarios(funcionarios) {
  gravarJson(CHAVE_FUNCIONARIOS, funcionarios);
}

function carregarDescontos() {
  return carregarJson(CHAVE_DESCONTOS);
}

function gravarDescontos(descontos) {
  gravarJson(CHAVE_DESCONTOS, descontos);
}

function carregarHistorico() {
  return carregarJson(CHAVE_HISTORICO);
}

function gravarHistorico(historico) {
  gravarJson(CHAVE_HISTORICO, historico);
}

function carregarCalendarios() {
  return carregarJson(CHAVE_CALENDARIOS);
}

function gravarCalendarios(calendarios) {
  gravarJson(CHAVE_CALENDARIOS, calendarios);
}

function carregarRegrasBeneficios() {
  return carregarJson(CHAVE_REGRAS_BENEFICIOS);
}

function gravarRegrasBeneficios(regras) {
  gravarJson(CHAVE_REGRAS_BENEFICIOS, regras);
}

function carregarHorasPagas() {
  return carregarJson(CHAVE_HORAS_PAGAS);
}

function gravarHorasPagas(horasPagas) {
  gravarJson(CHAVE_HORAS_PAGAS, horasPagas);
}

function carregarObservacoes() {
  return carregarJson(CHAVE_OBSERVACOES);
}

function gravarObservacoes(observacoes) {
  gravarJson(CHAVE_OBSERVACOES, observacoes);
}

function observacaoFuncionario(email) {
  return carregarObservacoes()[chaveDesconto(email)]?.texto || "";
}

function salvarObservacaoFuncionario(email) {
  const observacoes = carregarObservacoes();
  observacoes[chaveDesconto(email)] = {
    texto: document.getElementById(`observacaoFuncionario-${email}`)?.value || "",
    salvoEm: new Date().toISOString(),
  };
  gravarObservacoes(observacoes);
}

function carregarFerias() {
  return carregarJson(CHAVE_FERIAS);
}

function gravarFerias(ferias) {
  gravarJson(CHAVE_FERIAS, ferias);
}

function carregarQuitacaoFerias() {
  return carregarJson(CHAVE_QUITACAO_FERIAS);
}

function gravarQuitacaoFerias(quitacoes) {
  gravarJson(CHAVE_QUITACAO_FERIAS, quitacoes);
}

function anoRegistroFerias(ferias) {
  if (ferias?.anoReferencia) return Number(ferias.anoReferencia);
  if (ferias?.ida) return dataLocalPorIso(ferias.ida)?.getFullYear() || 0;
  return 0;
}

function feriasDoAno(email, tipo = "ferias", ano = anoFeriasSelecionado) {
  const dados = tipo === "quitacao" ? carregarQuitacaoFerias() : carregarFerias();
  const ferias = dados[email] || {};
  return anoRegistroFerias(ferias) === Number(ano) ? ferias : {};
}

function dadosFeriasDoModoAtual(email) {
  return feriasDoAno(email, modoTabelaFerias === "quitacao" ? "quitacao" : "ferias");
}

function carregarFeriasSelecionados() {
  const dados = bancoPronto ? bancoDados[CHAVE_FERIAS_SELECIONADOS] : lerLocalStorage(CHAVE_FERIAS_SELECIONADOS);
  return Array.isArray(dados) ? dados : [];
}

function gravarFeriasSelecionados(emails) {
  bancoDados[CHAVE_FERIAS_SELECIONADOS] = emails;
  localStorage.setItem(CHAVE_FERIAS_SELECIONADOS, JSON.stringify(emails));
  salvarDadoBanco(CHAVE_FERIAS_SELECIONADOS, emails);
}

function chaveFolha() {
  return `${ultimaFolhaAno}-${String(ultimaFolhaMes).padStart(2, "0")}`;
}

function chaveDesconto(email) {
  return `${chaveFolha()}-${email}`;
}

function pagamentoHorasFuncionario(email) {
  return carregarHorasPagas()[chaveDesconto(email)] || {};
}

function bancoHorasAplicadoNaFolhaAtual() {
  return Boolean(carregarHistorico()[chaveFolha()]?.bancoHorasAplicado);
}

function valorCampo(id) {
  return Number(document.getElementById(id).value || 0);
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function criarFuncionarioPadrao(email) {
  return {
    email,
    funcionario: "",
    nome: "",
    cargo: "",
    tipo: "horista",
    salario: 0,
    bancoHoras: 0,
    abono: 0,
    valeAlimentacao: 0,
    valeTransporte: 0,
    inativo: false,
  };
}

function normalizarFuncionario(funcionario, email) {
  return {
    ...criarFuncionarioPadrao(email),
    ...funcionario,
    email,
  };
}

function criarFolhaVazia(funcionario = {}) {
  return {
    funcionario: funcionario.funcionario || "",
    horas: 0,
    esquecimentos: 0,
    faltas: 0,
    atestados: 0,
    ferias: 0,
    semIntervalo: 0,
    outros: 0,
    descontoBeneficios: 0,
    registros: [],
  };
}

function incluirFuncionariosComFeriasNaFolha(folha) {
  if (!mesPermiteAjusteFerias()) return;

  const funcionarios = carregarFuncionarios();
  Object.keys(funcionarios).forEach((email) => {
    const funcionario = normalizarFuncionario(funcionarios[email], email);
    if (folha[email] || funcionarioInativo(funcionario) || !feriasAfetamFolhaMes(email)) return;
    folha[email] = criarFolhaVazia(funcionario);
  });
}

function nomeFuncionario(email) {
  const funcionario = normalizarFuncionario(carregarFuncionarios()[email], email);
  return funcionario.nome || email;
}

function funcionarioInativo(funcionario) {
  return Boolean(funcionario?.inativo);
}

function emailsOrdenados() {
  return Object.keys(ultimaFolha).sort((a, b) => nomeFuncionario(a).localeCompare(nomeFuncionario(b), "pt-BR"));
}

function abrirAba(nome) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
  document.querySelectorAll(".menu-item").forEach((item) => item.classList.remove("active"));

  document.getElementById(`aba-${nome}`).classList.add("active");
  document.querySelector(`[data-tab="${nome}"]`).classList.add("active");

  if (nome === "funcionarios") {
    renderizarFuncionarios();
  }

  if (nome === "ferias") {
    inicializarFerias();
  }

  if (nome === "historico") {
    renderizarHistorico();
  }
}

// Calculo do salario-base em public/calculoFolha.js (testado no Node).
function horasTotaisRegistros(folha) {
  return CalculoFolha.horasTotaisRegistros(folha);
}

function calcularResumoFuncionario(email, folha, funcionario, descontoManual) {
  const horas = horasTotaisRegistros(folha) + horasFeriadosPagosNoMes(funcionario);
  const salarioBase = Number(funcionario.salario || 0);
  const tipo = funcionario.tipo || "horista";
  const salario = CalculoFolha.salarioDoMes({
    tipo,
    salarioBase,
    horas,
    salarioMensalista: tipo === "mensalista" ? salarioMensalistaSemFerias(email, salarioBase) : 0,
  });
  const abono = Number(funcionario.abono || 0);
  const alimentacao = Number(funcionario.valeAlimentacao || 0);
  const transporte = Number(funcionario.valeTransporte || 0);
  const extras = abono + alimentacao + transporte;
  const valorBeneficios = alimentacao + transporte;
  const valorBeneficioDia = valorBeneficioPorDia(funcionario);
  const ajustesBeneficiosAtivos = ajustesBeneficiosAtivosNoMes();
  const unidadesDescontoBeneficios = diasComCodigosBeneficio(folha) + periodosAusentesBeneficio(folha, funcionario) / 2;
  const descontoBeneficios = ajustesBeneficiosAtivos ? unidadesDescontoBeneficios * valorBeneficioDia : 0;
  const adicionalBeneficios = ajustesBeneficiosAtivos ? diasNaoUteisTrabalhados(folha) * valorBeneficioDia : 0;
  const descontosManuais = Number(descontoManual.sesi || 0) + Number(descontoManual.vale || 0) + Number(descontoManual.outros || 0);
  const cargaPrevista = cargaPrevistaMensal(email);
  const bancoMesOriginal = tipo === "mensalista" ? horas - cargaPrevista : 0;
  const pagamentoHoras = pagamentoHorasFuncionario(email);
  const horasPagas = Number(pagamentoHoras.horas || 0);
  const valorHoraBanco = tipo === "mensalista" && cargaPrevista > 0 ? salarioBase / cargaPrevista : salarioBase;
  const valorHoraPaga = Number(pagamentoHoras.valorHora || valorHoraBanco);
  const valorHorasPagas = horasPagas * valorHoraPaga;
  const total = salario + extras + adicionalBeneficios + valorHorasPagas - descontoBeneficios - descontosManuais;
  const bancoMes = bancoMesOriginal - horasPagas;
  const bancoSalvo = Number(funcionario.bancoHoras || 0);
  const bancoJaAplicado = bancoHorasAplicadoNaFolhaAtual();
  const bancoAtual = bancoJaAplicado ? bancoSalvo - bancoMes : bancoSalvo;
  const bancoDepois = bancoJaAplicado ? bancoSalvo : bancoAtual + bancoMes;

  return {
    horas,
    salario,
    abono,
    alimentacao,
    transporte,
    extras,
    valorBeneficios,
    valorBeneficioDia,
    descontoBeneficios,
    adicionalBeneficios,
    descontosManuais,
    valorHorasPagas,
    valorHoraBanco,
    valorHoraPaga,
    horasPagas,
    total,
    bancoMesOriginal,
    bancoMes,
    bancoAtual,
    bancoDepois,
  };
}

async function gerarFolha() {
  const mes = document.getElementById("mes").value;
  const ano = document.getElementById("ano").value;
  const container = document.getElementById("resultado");

  if (mes === "ferias") {
    anoFeriasSelecionado = Number(ano);
    abrirDescontosRecibosFerias("ferias");
    return;
  }

  if (mes === "quitacao-ferias") {
    anoFeriasSelecionado = Number(ano);
    abrirDescontosRecibosFerias("quitacao");
    return;
  }

  if (modoDecimoTerceiroSelecionado()) {
    abrirDescontosRecibosDecimo(mes);
    return;
  }

  modoDescontos = "folha";
  container.innerHTML = '<p class="status">Gerando folha ponto...</p>';
  document.getElementById("linksFolha").innerHTML = "";
  document.getElementById("folhaDocumentos").innerHTML = "";

  document.getElementById("conferencia").innerHTML = "";

  try {
    const atualizar = usarDadosAtuaisNaProximaFolha ? "&atualizar=1" : "";
    usarDadosAtuaisNaProximaFolha = false;
    const res = await fetch(`http://localhost:3000/relatorio?mes=${mes}&ano=${ano}${atualizar}`);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.erro || "Erro ao gerar folha");
    }

    ultimaFolha = data;
    ultimaFolhaMes = mes;
    ultimaFolhaAno = ano;
    folhaSelecionada = "todos";

    // Pendencias (sem saida, nao conciliados, aparelhos com ponto preso...)
    // aparecem mesmo quando nenhum funcionario entrou na folha.
    carregarConferencia(mes, ano);

    const emails = Object.keys(data);
    if (emails.length === 0) {
      container.innerHTML = '<p class="status">Nenhum registro encontrado para este mês e ano.</p>';
      return;
    }

    incluirFuncionariosComFeriasNaFolha(data);

    const funcionarios = carregarFuncionarios();
    emails.forEach((email) => {
      const funcionario = normalizarFuncionario(funcionarios[email], email);
      funcionarios[email] = {
        ...funcionario,
        funcionario: funcionario.funcionario || data[email].funcionario || "",
      };
    });
    gravarFuncionarios(funcionarios);

    renderizarLinksFolha();
    renderizarResumoFolha();
    renderizarFolhaPonto();
    renderizarFuncionarios();

    if (!carregarHistorico()[chaveFolha()]) {
      abrirDescontosImpressao(true);
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="status error">Nao foi possivel gerar a folha. Verifique se o servidor esta rodando.</p>';
  }
}

function selecionarFolha(email) {
  folhaSelecionada = email;
  renderizarLinksFolha();
  renderizarFolhaPonto();
}

function modoFeriasSelecionado() {
  return ["ferias", "quitacao-ferias", "decimo-terceiro-1", "decimo-terceiro-2"].includes(document.getElementById("mes")?.value);
}

function modoDecimoTerceiroSelecionado() {
  return ["decimo-terceiro-1", "decimo-terceiro-2"].includes(document.getElementById("mes")?.value);
}

function modoReciboSelecionado() {
  return document.getElementById("mes")?.value || "";
}

function atualizarModoGeracao() {
  const modo = modoReciboSelecionado();
  const ferias = modoFeriasSelecionado();
  const decimo = modoDecimoTerceiroSelecionado();
  const ano = document.getElementById("ano");
  const botao = document.getElementById("botaoGerarFolha");

  if (ano) {
    // Permite selecionar o ano mesmo em modo de férias ou quitação
    ano.disabled = false;
    if (ferias) anoFeriasSelecionado = Number(ano.value);
  }
  if (botao) {
    botao.textContent = modo === "quitacao-ferias"
      ? "Gerar Quitacoes"
      : (decimo ? "Gerar Recibos" : (ferias ? "Gerar Recibos" : "Gerar Folha"));
  }

  if (decimo) {
    document.getElementById("linksFolha").innerHTML = "";
    document.getElementById("resultado").innerHTML = '<p class="status">Confira o ano de referencia e gere os recibos do decimo terceiro.</p>';
    document.getElementById("folhaDocumentos").innerHTML = "";
    return;
  }

  if (ferias) {
    if (modo === "quitacao-ferias" && modoTabelaFerias !== "quitacao") {
      modoTabelaFerias = "quitacao";
      document.getElementById("modoFeriasBotao")?.classList.remove("active");
      document.getElementById("modoQuitacaoFeriasBotao")?.classList.add("active");
      renderizarTabelaFerias();
    }
    document.getElementById("linksFolha").innerHTML = "";
    document.getElementById("resultado").innerHTML = modo === "quitacao-ferias"
      ? '<p class="status">Use a aba Ferias em Quitação das Férias para selecionar funcionarios e informar a data inicial da quitação.</p>'
      : '<p class="status">Use a aba Ferias para selecionar funcionarios e datas completas antes de gerar os recibos.</p>';
    document.getElementById("folhaDocumentos").innerHTML = "";
  }
}

function renderizarLinksFolha() {
  const links = document.getElementById("linksFolha");
  const emails = emailsOrdenados();

  links.innerHTML = `
    <button class="${folhaSelecionada === "todos" ? "active" : ""}" type="button" onclick="selecionarFolha('todos')">
      Folha de Todos Funcionarios
    </button>
    ${emails.map((email) => `
      <button class="${folhaSelecionada === email ? "active" : ""}" type="button" onclick="selecionarFolha('${email}')">
        ${nomeFuncionario(email)}
      </button>
    `).join("")}
  `;
}

function renderizarResumoFolha() {
  const container = document.getElementById("resultado");
  container.innerHTML = "";
}

function registrosPorDia(registros) {
  const grupos = {};

  (registros || []).forEach((registro) => {
    if (!grupos[registro.data]) grupos[registro.data] = [];
    grupos[registro.data].push(registro);
  });

  Object.keys(grupos).forEach((data) => {
    grupos[data].sort((a, b) => a.entrada.localeCompare(b.entrada));
  });

  return grupos;
}

function diasDoMes(mes, ano) {
  const total = new Date(Number(ano), Number(mes), 0).getDate();
  return Array.from({ length: total }, (_, index) => {
    const dia = index + 1;
    const data = new Date(Number(ano), Number(mes) - 1, dia);
    const iso = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    return { dia, data, iso };
  });
}

function isoData(ano, mes, dia) {
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

function adicionarDias(data, quantidade) {
  const novaData = new Date(data);
  novaData.setDate(novaData.getDate() + quantidade);
  return novaData;
}

function dataLocalPorIso(iso) {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
}

function isoDaData(data) {
  return isoData(data.getFullYear(), data.getMonth() + 1, data.getDate());
}

function diasEntreInclusivo(inicioIso, fimIso) {
  const inicio = dataLocalPorIso(inicioIso);
  const fim = dataLocalPorIso(fimIso);
  if (!inicio || !fim || fim < inicio) return 0;
  return Math.floor((fim - inicio) / 86400000) + 1;
}

function dataPascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function feriadosNacionaisDoAno(ano) {
  const anoNumero = Number(ano);
  const feriados = {};

  FERIADOS_NACIONAIS_FIXOS
    .filter((feriado) => anoNumero >= feriado.desde)
    .forEach((feriado) => {
      feriados[isoData(anoNumero, feriado.mes, feriado.dia)] = feriado.nome;
    });

  const sextaSanta = adicionarDias(dataPascoa(anoNumero), -2);
  feriados[isoData(anoNumero, sextaSanta.getMonth() + 1, sextaSanta.getDate())] = "Paixao de Cristo";

  return feriados;
}

function nomeFeriadoNacional(iso) {
  if (!iso) return "";
  const ano = Number(iso.slice(0, 4));
  return feriadosNacionaisDoAno(ano)[iso] || "";
}

function diaFeriadoNacional(dia) {
  return Boolean(nomeFeriadoNacional(dia.iso));
}

function diaUtilPadrao(data) {
  return data.getDay() !== 0 && data.getDay() !== 6;
}

function calendarioDoMes() {
  return carregarCalendarios()[chaveFolha()] || {};
}

function regraBeneficiosDoMes() {
  return carregarRegrasBeneficios()[chaveFolha()] || {};
}

function ajustesBeneficiosAtivosNoMes() {
  return regraBeneficiosDoMes().ajustesDesativados !== true;
}

function editarBancoHorasAtivoNoMes() {
  return regraBeneficiosDoMes().editarBancoHoras !== false;
}

function atualizarSwitchBeneficios() {
  const campo = document.getElementById("desativarAjustesBeneficios");
  if (campo) campo.checked = !ajustesBeneficiosAtivosNoMes();
}

function atualizarSwitchBancoHoras() {
  const campo = document.getElementById("editarBancoHorasFuncionarios");
  if (campo) campo.checked = editarBancoHorasAtivoNoMes();
}

function alternarAjustesBeneficios() {
  const campo = document.getElementById("desativarAjustesBeneficios");
  const regras = carregarRegrasBeneficios();
  const chave = chaveFolha();

  regras[chave] = {
    ...(regras[chave] || {}),
    ajustesDesativados: Boolean(campo?.checked),
  };

  gravarRegrasBeneficios(regras);
  renderizarResumoFolha();
  renderizarFolhaPonto();
}

function alternarEdicaoBancoHoras() {
  const campo = document.getElementById("editarBancoHorasFuncionarios");
  const regras = carregarRegrasBeneficios();
  const chave = chaveFolha();

  regras[chave] = {
    ...(regras[chave] || {}),
    editarBancoHoras: Boolean(campo?.checked),
  };

  gravarRegrasBeneficios(regras);
}

function diaUtilCalendario(dia) {
  const calendario = calendarioDoMes();
  if (typeof calendario[dia.iso] === "boolean") return calendario[dia.iso];
  if (diaFeriadoNacional(dia)) return false;
  return diaUtilPadrao(dia.data);
}

function diaUtilAlteradoParaNaoUtil(dia) {
  return diaUtilPadrao(dia.data) && !diaUtilCalendario(dia);
}

function diaComputavelFolha(dia) {
  return diaUtilCalendario(dia) || diaUtilAlteradoParaNaoUtil(dia);
}

function mesPermiteAjusteFerias() {
  return [1, 12].includes(Number(ultimaFolhaMes));
}

function feriasFolhaFuncionario(email) {
  const ferias = carregarFerias()[email] || {};
  return feriasCompletas(ferias) ? ferias : null;
}

function diaDentroDasFerias(email, iso) {
  const ferias = feriasFolhaFuncionario(email);
  return Boolean(ferias && iso >= ferias.ida && iso <= ferias.volta);
}

function diaFeriasNaFolha(email, dia) {
  return diaComputavelFolha(dia) && diaDentroDasFerias(email, dia.iso);
}

function feriasAfetamFolhaMes(email) {
  if (!mesPermiteAjusteFerias()) return false;

  return diasDoMes(ultimaFolhaMes, ultimaFolhaAno)
    .some((dia) => diaFeriasNaFolha(email, dia));
}

function diasComputaveisFolhaMes() {
  return diasDoMes(ultimaFolhaMes, ultimaFolhaAno)
    .filter((dia) => diaComputavelFolha(dia))
    .length;
}

function diasFeriasComputaveisMes(email) {
  if (!feriasAfetamFolhaMes(email)) return 0;

  return diasDoMes(ultimaFolhaMes, ultimaFolhaAno)
    .filter((dia) => diaFeriasNaFolha(email, dia))
    .length;
}

function diasTrabalhoComputaveisMes(email) {
  return Math.max(0, diasComputaveisFolhaMes() - diasFeriasComputaveisMes(email));
}

function horasPrevistasSemFerias(email) {
  return diasTrabalhoComputaveisMes(email) * JORNADA_DIARIA;
}

function salarioMensalistaSemFerias(email, salarioBase) {
  if (!feriasAfetamFolhaMes(email)) return salarioBase;

  const diasComputaveis = diasComputaveisFolhaMes();
  if (diasComputaveis <= 0) return 0;

  return salarioBase * (diasTrabalhoComputaveisMes(email) / diasComputaveis);
}

function horasFeriadosPagosNoMes(funcionario) {
  if ((funcionario.tipo || "horista") !== "mensalista") return 0;

  return diasDoMes(ultimaFolhaMes, ultimaFolhaAno)
    .filter((dia) => diaUtilAlteradoParaNaoUtil(dia) && !diaFeriasNaFolha(funcionario.email, dia))
    .length * JORNADA_DIARIA;
}

function cargaPrevistaMensal(email = "") {
  return diasDoMes(ultimaFolhaMes, ultimaFolhaAno)
    .filter((dia) => diaComputavelFolha(dia) && (!email || !diaFeriasNaFolha(email, dia)))
    .length * JORNADA_DIARIA;
}

function quantidadeDiasUteis() {
  return diasDoMes(ultimaFolhaMes, ultimaFolhaAno)
    .filter((dia) => diaUtilCalendario(dia))
    .length;
}

function valorBeneficioPorDia(funcionario) {
  const diasUteis = quantidadeDiasUteis();
  const valorBeneficios = Number(funcionario.valeAlimentacao || 0) + Number(funcionario.valeTransporte || 0);
  return diasUteis > 0 ? valorBeneficios / diasUteis : 0;
}

function diasComCodigosBeneficio(folha) {
  const dias = new Set();

  (folha.registros || []).forEach((registro) => {
    if ([2, 3, 6, CODIGO_BANCO_HORAS].includes(Number(registro.codigo || 0))) {
      dias.add(registro.data);
    }
  });

  return dias.size;
}

function codigoDia(registros) {
  return (registros || []).find((registro) => Number(registro.codigo || 0) !== 0)?.codigo || 0;
}

function periodoSemRegistro(registro) {
  return !registro.entrada && !registro.saida;
}

function diaAnteriorAoAtual(dia) {
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return dia.data < inicioHoje;
}

function funcionarioMensalista(funcionario) {
  return (funcionario.tipo || "horista") === "mensalista";
}

function periodosAusentesDia(registros, dia, funcionario) {
  if (feriasAfetamFolhaMes(funcionario.email)) {
    return { manha: false, tarde: false, total: 0 };
  }

  if (!funcionarioMensalista(funcionario) || !diaAnteriorAoAtual(dia) || !diaUtilCalendario(dia) || codigoDia(registros)) {
    return { manha: false, tarde: false, total: 0 };
  }

  const manhaAusente = periodoSemRegistro(registroManha(registros));
  const tardeAusente = periodoSemRegistro(registroTarde(registros));

  return {
    manha: manhaAusente,
    tarde: tardeAusente,
    total: Number(manhaAusente) + Number(tardeAusente),
  };
}

function totalPeriodosAusentesAutomaticos(folha, funcionario) {
  const grupos = registrosPorDia(folha.registros);

  return diasDoMes(ultimaFolhaMes, ultimaFolhaAno).reduce((total, dia) => {
    const ausencias = periodosAusentesDia(grupos[dia.iso] || [], dia, funcionario);
    return total + ausencias.total;
  }, 0);
}

function periodosAusentesBeneficio(folha, funcionario) {
  return totalPeriodosAusentesAutomaticos(folha, funcionario);
}

function horasAusentesBancoAutomatico(folha, funcionario) {
  return totalPeriodosAusentesAutomaticos(folha, funcionario) * JORNADA_PERIODO;
}

function diasNaoUteisTrabalhados(folha) {
  const dias = new Set();

  (folha.registros || []).forEach((registro) => {
    if (Number(registro.horas || 0) <= 0) return;

    const dia = diasDoMes(ultimaFolhaMes, ultimaFolhaAno).find((item) => item.iso === registro.data);
    if (dia && !diaUtilCalendario(dia)) {
      dias.add(registro.data);
    }
  });

  return dias.size;
}

function alternarDiaCalendario(iso) {
  const calendarios = carregarCalendarios();
  const chave = chaveFolha();
  const calendario = calendarios[chave] || {};
  const dia = diasDoMes(ultimaFolhaMes, ultimaFolhaAno).find((item) => item.iso === iso);

  if (!dia) return;

  const atual = diaUtilCalendario(dia);
  calendario[iso] = !atual;
  calendarios[chave] = calendario;
  gravarCalendarios(calendarios);
  renderizarCalendarioUtil();

  if (Object.keys(ultimaFolha).length > 0) {
    renderizarResumoFolha();
    renderizarFolhaPonto();
  }
}

function nomeDia(data) {
  return ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"][data.getDay()];
}

function formatarHoras(valor) {
  const numero = Number(valor || 0);
  const sinal = numero < 0 ? "-" : "";
  const totalMinutos = Math.round(Math.abs(numero) * 60);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  return `${sinal}${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}`;
}

function horaParaMinutos(hora) {
  if (!hora) return 0;
  const [horas, minutos] = hora.split(":").map(Number);
  return horas * 60 + minutos;
}

function registroManha(registros) {
  return registros.find((registro) => horaParaMinutos(registro.entrada) < 12 * 60) || {};
}

function registroTarde(registros) {
  return registros.find((registro) => horaParaMinutos(registro.entrada) >= 12 * 60) || {};
}

function rotuloMesReferencia() {
  const mes = Number(ultimaFolhaMes);
  return `${MESES_ABREV[mes - 1]}/${String(ultimaFolhaAno).slice(-2)}`;
}

function dataAssinaturaFolha() {
  const mesProximo = Number(ultimaFolhaMes) === 12 ? 1 : Number(ultimaFolhaMes) + 1;
  const anoProximo = Number(ultimaFolhaMes) === 12 ? Number(ultimaFolhaAno) + 1 : Number(ultimaFolhaAno);
  const primeiroDiaUtil = diasDoMes(mesProximo, anoProximo).find((dia) => diaUtilCalendario(dia));
  const data = primeiroDiaUtil ? primeiroDiaUtil.data : new Date(anoProximo, mesProximo - 1, 1);
  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  return `${data.getDate()} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
}

function dataPorExtenso(data = new Date()) {
  return `${data.getDate()} de ${nomeMes(data.getMonth() + 1).toLowerCase()} de ${data.getFullYear()}`;
}

function arquivoSeguro(texto) {
  return String(texto || "funcionario")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function chaveDescontoReciboFerias(email, ferias, tipo = "ferias") {
  return `${tipo}-${email}-${ferias?.ida || ""}-${ferias?.volta || ""}`;
}

function descontoTotalReciboFerias(email, ferias, tipo = "ferias") {
  const desconto = carregarDescontos()[chaveDescontoReciboFerias(email, ferias, tipo)] || {};
  return Number(desconto.sesi || 0) + Number(desconto.vale || 0) + Number(desconto.outros || 0);
}

function feriasCompletas(ferias) {
  return Boolean(ferias?.ida && ferias?.volta && Number(ferias?.dias || diasEntreInclusivo(ferias.ida, ferias.volta)) > 0);
}

function emailsParaRecibosFerias() {
  const funcionarios = carregarFuncionarios();
  const selecionados = emailsFeriasSelecionados();
  const emails = selecionados.length > 0 ? selecionados : Object.keys(carregarFerias());

  return emails
    .filter((email) => funcionarios[email] && feriasCompletas(feriasDoAno(email, "ferias")))
    .sort((a, b) => nomeFuncionario(a).localeCompare(nomeFuncionario(b), "pt-BR"));
}

function diasSaldoFerias(email) {
  // Se estivermos no modo quitação, o saldo remanescente vem das férias do ano anterior
  const anoSaldo = modoTabelaFerias === "quitacao" ? Number(anoFeriasSelecionado) - 1 : Number(anoFeriasSelecionado);
  const ferias = feriasDoAno(email, "ferias", anoSaldo);
  const diasPagos = Number(ferias.dias || diasEntreInclusivo(ferias.ida, ferias.volta));
  return Math.max(0, 30 - diasPagos);
}

function quitacaoFeriasCompletas(email) {
  const quitacao = feriasDoAno(email, "quitacao");
  return diasSaldoFerias(email) > 0 && feriasCompletas(quitacao);
}

function emailsParaRecibosQuitacaoFerias() {
  const funcionarios = carregarFuncionarios();
  const selecionados = emailsFeriasSelecionados();
  const emails = selecionados.length > 0 ? selecionados : Object.keys(carregarQuitacaoFerias());

  return emails
    .filter((email) => funcionarios[email] && quitacaoFeriasCompletas(email))
    .sort((a, b) => nomeFuncionario(a).localeCompare(nomeFuncionario(b), "pt-BR"));
}

function montarDadosReciboFerias(email, tipo = "ferias") {
  const funcionario = normalizarFuncionario(carregarFuncionarios()[email], email);
  const ferias = feriasDoAno(email, tipo);
  const dias = Number(ferias.dias || diasEntreInclusivo(ferias.ida, ferias.volta));
  const salario = Number(funcionario.salario || 0);
  const salarioProporcional = salario * (dias / 30);
  const terco = salario / 3;
  const tercoProporcional = salarioProporcional / 3;
  const soma = salario + terco;
  const somaProporcional = salarioProporcional + tercoProporcional;
  const descontos = descontoTotalReciboFerias(email, ferias, tipo);
  const retorno = ferias.retorno || proximoDiaUtilFerias(ferias.volta);
  const saldoFerias = tipo === "quitacao" ? 0 : Math.max(0, 30 - dias);

  return {
    email,
    modelo: tipo === "quitacao" ? "quitacao-ferias" : "ferias",
    titulo: tipo === "quitacao" ? "Recibo de Quitação do Saldo de Férias" : "Recibo de Férias",
    nomeArquivo: `${tipo === "quitacao" ? "recibo-quitacao-ferias" : "recibo-ferias"}-${arquivoSeguro(funcionario.nome || email)}.docx`,
    dados: {
      NomeFuncionario: funcionario.nome || email,
      CargoFuncionario: funcionario.cargo || "",
      DiasFerias: dias,
      DiasQuitar: tipo === "quitacao" ? dias : "",
      SaldoFerias: saldoFerias,
      Salario: formatarMoeda(salario),
      SalarioP: formatarMoeda(salarioProporcional),
      Terco: formatarMoeda(terco),
      TercoP: formatarMoeda(tercoProporcional),
      Soma: formatarMoeda(soma),
      SomaP: formatarMoeda(somaProporcional),
      Descontos: formatarMoeda(descontos),
      SBMenosD: formatarMoeda(somaProporcional - descontos),
      DataCmc: formatarDataCurta(ferias.ida),
      DataTermino: formatarDataCurta(ferias.volta),
      DataVolta: formatarDataCurta(retorno),
      DataHoje: dataPorExtenso(),
    },
  };
}

function recibosFeriasProntos(tipo = "ferias") {
  const emails = tipo === "quitacao" ? emailsParaRecibosQuitacaoFerias() : emailsParaRecibosFerias();
  return emails.map((email) => montarDadosReciboFerias(email, tipo));
}

function emailsParaRecibosDecimo(mesesPorEmail = mesesDecimoCache) {
  const funcionarios = carregarFuncionarios();

  return Object.keys(funcionarios)
    .filter((email) => {
      const funcionario = normalizarFuncionario(funcionarios[email], email);
      const meses = Number(mesesPorEmail[email]?.totalMeses || 0);
      return !funcionarioInativo(funcionario) && funcionario.tipo !== "horista" && meses > 0;
    })
    .sort((a, b) => nomeFuncionario(a).localeCompare(nomeFuncionario(b), "pt-BR"));
}

function chaveDescontoReciboDecimo(email, tipo, ano) {
  return `${tipo}-${email}-${ano}`;
}

function descontoTotalReciboDecimo(email, tipo, ano) {
  const desconto = carregarDescontos()[chaveDescontoReciboDecimo(email, tipo, ano)] || {};
  return Number(desconto.sesi || 0) + Number(desconto.vale || 0) + Number(desconto.outros || 0);
}

async function buscarMesesDecimo(ano) {
  const res = await fetch(`http://localhost:3000/decimo-terceiro/meses?ano=${ano}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.erro || "Erro ao calcular meses trabalhados");
  }

  mesesDecimoCache = data || {};
  return mesesDecimoCache;
}

function tituloReciboDecimo(tipo) {
  return tipo === "decimo-terceiro-2" ? "2a Parcela do Decimo Terceiro" : "1a Parcela do Decimo Terceiro";
}

function montarDadosReciboDecimo(email, tipo, ano, mesesPorEmail = mesesDecimoCache) {
  const funcionario = normalizarFuncionario(carregarFuncionarios()[email], email);
  const meses = Math.min(12, Math.max(0, Number(mesesPorEmail[email]?.totalMeses || 0)));
  const salario = Number(funcionario.salario || 0);
  const totalDecimo = (salario / 12) * meses;
  const parcela = totalDecimo / 2;
  const descontos = descontoTotalReciboDecimo(email, tipo, ano);
  const totalLiquido = parcela - descontos;

  return {
    email,
    modelo: tipo,
    titulo: tituloReciboDecimo(tipo),
    mesesTrabalhados: meses,
    nomeArquivo: `recibo-${tipo}-${arquivoSeguro(funcionario.nome || email)}.docx`,
    dados: {
      NomeFuncionario: funcionario.nome || email,
      CargoFuncionario: funcionario.cargo || "",
      PrimeiraParcela: formatarMoeda(tipo === "decimo-terceiro-1" ? parcela : 0),
      SegundaParcela: formatarMoeda(tipo === "decimo-terceiro-2" ? parcela : 0),
      TotalBruto: formatarMoeda(parcela),
      Descontos: formatarMoeda(descontos),
      TotalLiquido: formatarMoeda(totalLiquido),
      AnoReferencia: String(ano),
      DataHoje: dataPorExtenso(),
    },
  };
}

function recibosDecimoProntos(tipo = modoReciboSelecionado(), mesesPorEmail = mesesDecimoCache) {
  const ano = Number(document.getElementById("ano")?.value || new Date().getFullYear());
  return emailsParaRecibosDecimo(mesesPorEmail).map((email) => montarDadosReciboDecimo(email, tipo, ano, mesesPorEmail));
}

function base64ParaBlob(conteudo, tipo) {
  const bytes = atob(conteudo);
  const partes = [];

  for (let i = 0; i < bytes.length; i += 1024) {
    const fatia = bytes.slice(i, i + 1024);
    const numeros = Array.from(fatia, (char) => char.charCodeAt(0));
    partes.push(new Uint8Array(numeros));
  }

  return new Blob(partes, { type: tipo });
}

async function salvarArquivoBase64(nomeArquivo, conteudo, tipo) {
  try {
    const blob = base64ParaBlob(conteudo, tipo);

    if (window.showSaveFilePicker) {
      const extensao = nomeArquivo.split(".").pop();
      const handle = await window.showSaveFilePicker({
        suggestedName: nomeArquivo,
        types: [{
          description: extensao.toUpperCase(),
          accept: { [tipo]: [`.${extensao}`] },
        }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    }

    const link = document.createElement("a");
    link.download = nomeArquivo;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error(err);
      document.getElementById("resultado").innerHTML = '<p class="status error">Nao foi possivel salvar o arquivo.</p>';
    }
  }
}

function salvarArquivoWordFerias(index) {
  const arquivo = recibosFeriasGerados[index];
  if (!arquivo) return;

  salvarArquivoBase64(
    arquivo.nomeArquivo,
    arquivo.conteudo,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function salvarTodosRecibosFerias() {
  if (!recibosFeriasZip) return;

  salvarArquivoBase64(recibosFeriasZip.nomeArquivo, recibosFeriasZip.conteudo, "application/zip");
}

function renderizarRecibosFerias(recibos, resposta) {
  const destino = document.getElementById("folhaDocumentos");
  recibosFeriasGerados = resposta.arquivos || [];
  recibosFeriasZip = resposta.zip || null;

  destino.innerHTML = `
    <div class="vacation-receipt-actions">
      ${recibosFeriasZip ? '<button class="download-button" type="button" onclick="salvarTodosRecibosFerias()">Salvar todos</button>' : ""}
      <button type="button" onclick="imprimir()">Imprimir todos</button>
    </div>
    ${recibos.map((recibo, index) => {
      const arquivo = recibosFeriasGerados[index];
      const dados = recibo.dados;
      const quitacao = recibo.modelo === "quitacao-ferias";
      const decimo = ["decimo-terceiro-1", "decimo-terceiro-2"].includes(recibo.modelo);
      return `
        <section class="vacation-receipt-page">
          <div class="vacation-receipt-head">
            <strong>${recibo.titulo || "Recibo de Férias"}</strong>
            ${arquivo ? `<button type="button" onclick="salvarArquivoWordFerias(${index})">Salvar Word</button>` : ""}
          </div>
          <div class="vacation-receipt-grid">
            <p><strong>Funcionário</strong><span>${dados.NomeFuncionario}</span></p>
            <p><strong>Cargo</strong><span>${dados.CargoFuncionario || "-"}</span></p>
            ${decimo ? `
              <p><strong>Meses</strong><span>${recibo.mesesTrabalhados}</span></p>
              <p><strong>Ano</strong><span>${dados.AnoReferencia}</span></p>
              <p><strong>Bruto</strong><span>${dados.TotalBruto}</span></p>
              <p><strong>Descontos</strong><span>${dados.Descontos}</span></p>
              <p><strong>Liquido</strong><span>${dados.TotalLiquido}</span></p>
            ` : `<p><strong>Dias</strong><span>${dados.DiasFerias}</span></p>
            ${quitacao ? "" : `<p><strong>Saldo</strong><span>${dados.SaldoFerias}</span></p>`}
            <p><strong>Início</strong><span>${dados.DataCmc}</span></p>
            <p><strong>Término</strong><span>${dados.DataTermino}</span></p>
            <p><strong>Retorno</strong><span>${dados.DataVolta}</span></p>
            <p><strong>Líquido</strong><span>${dados.SBMenosD}</span></p>`}
          </div>
        </section>
      `;
    }).join("")}
  `;
}

async function gerarRecibosFerias(tipo = modoDescontos === "quitacao" ? "quitacao" : "ferias") {
  const container = document.getElementById("resultado");
  const recibos = recibosFeriasProntos(tipo);
  const quitacao = tipo === "quitacao";

  if (recibos.length === 0) {
    container.innerHTML = quitacao
      ? '<p class="status">Selecione funcionarios na aba Ferias, entre em Quitação das Férias e informe a data inicial da quitação.</p>'
      : '<p class="status">Selecione funcionarios na aba Ferias e complete ida, volta e dias antes de gerar recibos.</p>';
    return;
  }

  container.innerHTML = quitacao ? '<p class="status">Gerando recibos de quitacao de ferias...</p>' : '<p class="status">Gerando recibos de ferias...</p>';
  document.getElementById("linksFolha").innerHTML = "";
  document.getElementById("folhaDocumentos").innerHTML = "";

  try {
    const res = await fetch("http://localhost:3000/recibos-ferias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recibos, modelo: quitacao ? "quitacao-ferias" : "ferias" }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.erro || "Erro ao gerar recibos de ferias");
    }

    container.innerHTML = `<p class="status saved">${recibos.length} recibo(s) ${quitacao ? "de quitacao de ferias" : "de ferias"} gerado(s).</p>`;
    renderizarRecibosFerias(recibos, data);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="status error">Nao foi possivel gerar os recibos de ferias. Verifique se o modelo Recibo de Férias.docx existe e se o servidor foi reiniciado.</p>';
  }
}

function abrirDescontosRecibosFerias(tipo = "ferias") {
  const recibos = recibosFeriasProntos(tipo);
  const quitacao = tipo === "quitacao";

  if (recibos.length === 0) {
    document.getElementById("resultado").innerHTML = quitacao
      ? '<p class="status">Selecione funcionarios na aba Ferias, entre em Quitação das Férias e informe a data inicial da quitação.</p>'
      : '<p class="status">Selecione funcionarios na aba Ferias e complete ida, volta e dias antes de gerar recibos.</p>';
    document.getElementById("folhaDocumentos").innerHTML = "";
    return;
  }

  modoDescontos = tipo;
  abrirDescontosImpressao(true);
}

async function gerarRecibosDecimo(tipo = modoReciboSelecionado()) {
  const container = document.getElementById("resultado");
  const ano = Number(document.getElementById("ano").value || new Date().getFullYear());

  try {
    const mesesPorEmail = await buscarMesesDecimo(ano);
    const recibos = recibosDecimoProntos(tipo, mesesPorEmail);

    if (recibos.length === 0) {
      container.innerHTML = '<p class="status">Nenhum funcionario ativo com meses trabalhados neste ano.</p>';
      document.getElementById("folhaDocumentos").innerHTML = "";
      return;
    }

    container.innerHTML = `<p class="status">Gerando recibos de ${tituloReciboDecimo(tipo).toLowerCase()}...</p>`;
    document.getElementById("linksFolha").innerHTML = "";
    document.getElementById("folhaDocumentos").innerHTML = "";

    const res = await fetch("http://localhost:3000/recibos-ferias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recibos, modelo: tipo }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.erro || "Erro ao gerar recibos do decimo terceiro");
    }

    container.innerHTML = `<p class="status saved">${recibos.length} recibo(s) de ${tituloReciboDecimo(tipo).toLowerCase()} gerado(s).</p>`;
    renderizarRecibosFerias(recibos, data);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="status error">Nao foi possivel gerar os recibos do decimo terceiro. Verifique se o servidor esta rodando e se os modelos existem.</p>';
  }
}

async function abrirDescontosRecibosDecimo(tipo = modoReciboSelecionado()) {
  const container = document.getElementById("resultado");
  const ano = Number(document.getElementById("ano").value || new Date().getFullYear());

  try {
    container.innerHTML = '<p class="status">Calculando meses trabalhados...</p>';
    await buscarMesesDecimo(ano);

    if (emailsParaRecibosDecimo().length === 0) {
      container.innerHTML = '<p class="status">Nenhum funcionario ativo com meses trabalhados neste ano.</p>';
      document.getElementById("folhaDocumentos").innerHTML = "";
      return;
    }

    modoDescontos = tipo;
    abrirDescontosImpressao(true);
  } catch (err) {
    console.error(err);
    container.innerHTML = '<p class="status error">Nao foi possivel calcular os meses trabalhados para o decimo terceiro.</p>';
  }
}

function modoDecimoDescontos() {
  return ["decimo-terceiro-1", "decimo-terceiro-2"].includes(modoDescontos);
}

function tituloModoDescontos() {
  if (modoDescontos === "quitacao") return "Quitacao de ferias";
  if (modoDescontos === "ferias") return "Recibos de ferias";
  if (modoDecimoDescontos()) return tituloReciboDecimo(modoDescontos);
  return "Folha";
}

function renderizarFolhaPonto() {
  const destino = document.getElementById("folhaDocumentos");
  const emails = folhaSelecionada === "todos" ? emailsOrdenados() : [folhaSelecionada];
  const folhaModelo = folhaSelecionada === "todos" ? montarFolhaModelo() : "";

  destino.innerHTML = folhaModelo + emails.map((email) => montarFolhaPonto(email)).join("");
}

function abrirPagamentoHoras(email) {
  const folhaJaNoHistorico = Boolean(carregarHistorico()[chaveFolha()]);
  if (bancoHorasAplicadoNaFolhaAtual() || folhaJaNoHistorico || modoFeriasSelecionado()) return;

  const funcionarios = carregarFuncionarios();
  const descontos = carregarDescontos();
  const funcionario = normalizarFuncionario(funcionarios[email], email);
  const folha = ultimaFolha[email];
  if (!folha) return;

  const resumo = calcularResumoFuncionario(email, folha, funcionario, descontos[chaveDesconto(email)] || {});
  const pagamentoHoras = pagamentoHorasFuncionario(email);
  const horasSugeridas = Object.prototype.hasOwnProperty.call(pagamentoHoras, "horas")
    ? Number(pagamentoHoras.horas || 0)
    : Math.max(0, resumo.bancoMesOriginal);

  document.getElementById("pagamentoHorasEmail").value = email;
  document.getElementById("pagamentoHorasValorBase").value = resumo.valorHoraBanco;
  document.getElementById("pagamentoHorasSaldo").textContent = `${resumo.bancoMesOriginal.toFixed(2)}h`;
  document.getElementById("pagamentoHorasQuantidade").value = horasSugeridas.toFixed(2);
  document.getElementById("pagamentoHorasValor").textContent = formatarMoeda(resumo.valorHoraBanco);
  atualizarTotalPagamentoHoras();
  document.getElementById("modalPagamentoHoras").classList.add("active");
}

function atualizarTotalPagamentoHoras() {
  const horas = Number(document.getElementById("pagamentoHorasQuantidade")?.value || 0);
  const valorHora = Number(document.getElementById("pagamentoHorasValorBase")?.value || 0);
  const total = horas * valorHora;
  const rotulo = total < 0 ? `${formatarMoeda(Math.abs(total))} desconto` : formatarMoeda(total);
  document.getElementById("pagamentoHorasTotal").textContent = rotulo;
}

function fecharPagamentoHoras() {
  document.getElementById("modalPagamentoHoras").classList.remove("active");
}

function confirmarPagamentoHoras() {
  const email = document.getElementById("pagamentoHorasEmail").value;
  const funcionarios = carregarFuncionarios();
  const descontos = carregarDescontos();
  const funcionario = normalizarFuncionario(funcionarios[email], email);
  const folha = ultimaFolha[email];
  if (!folha) return;

  const resumo = calcularResumoFuncionario(email, folha, funcionario, descontos[chaveDesconto(email)] || {});
  const horasLancadas = Number(document.getElementById("pagamentoHorasQuantidade").value || 0);

  const horasPagas = carregarHorasPagas();
  horasPagas[chaveDesconto(email)] = {
    horas: horasLancadas,
    valorHora: resumo.valorHoraBanco,
    pagoEm: new Date().toISOString(),
  };

  gravarHorasPagas(horasPagas);
  fecharPagamentoHoras();
  renderizarResumoFolha();
  renderizarFolhaPonto();
}

function montarFolhaModelo() {
  const funcionarios = carregarFuncionarios();
  const descontos = carregarDescontos();
  const emails = emailsOrdenados();
  let totalHoras = 0;

  const linhas = diasDoMes(ultimaFolhaMes, ultimaFolhaAno).map(({ dia, data, iso }) => {
    const diaCalendario = { data, iso };
    const util = diaUtilCalendario(diaCalendario);
    const feriadoSemana = diaUtilAlteradoParaNaoUtil(diaCalendario);
    const horasDia = util || feriadoSemana ? JORNADA_DIARIA : 0;
    const manhaEntrada = feriadoSemana ? "" : (util ? "08:00" : "00:00");
    const manhaSaida = feriadoSemana ? "" : (util ? "12:00" : "00:00");
    const tardeEntrada = feriadoSemana ? "" : (util ? "13:00" : "00:00");
    const tardeSaida = feriadoSemana ? "" : (util ? "17:48" : "00:00");
    totalHoras += horasDia;

    return `
      <tr class="${[util ? "" : "non-working-row", feriadoSemana ? "holiday-row" : ""].filter(Boolean).join(" ")}">
        <td>${dia}</td>
        <td>${nomeDia(data)}</td>
        <td>${manhaEntrada}</td>
        <td>${manhaSaida}</td>
        <td>${tardeEntrada}</td>
        <td>${tardeSaida}</td>
        <td><strong>${formatarHoras(horasDia)}</strong></td>
        <td>${feriadoSemana ? 8 : ""}</td>
      </tr>
    `;
  }).join("");

  const totais = emails.reduce((acc, email) => {
    const funcionario = normalizarFuncionario(funcionarios[email], email);
    const folha = ultimaFolha[email];
    const descontoManual = descontos[chaveDesconto(email)] || {};
    const resumo = calcularResumoFuncionario(email, folha, funcionario, descontoManual);

    acc.salario += resumo.salario;
    acc.abono += Number(funcionario.abono || 0);
    acc.alimentacao += Number(funcionario.valeAlimentacao || 0);
    acc.transporte += Number(funcionario.valeTransporte || 0);
    acc.descontos += resumo.descontoBeneficios + resumo.descontosManuais;
    acc.sesi += Number(descontoManual.sesi || 0);
    acc.vale += Number(descontoManual.vale || 0);
    acc.outros += Number(descontoManual.outros || 0);
    acc.totalFolha += resumo.total;

    if (funcionario.tipo === "mensalista") {
      acc.saldoAcumulado += Number(funcionario.bancoHoras || 0);
      acc.saldoMes += resumo.bancoMes;
      acc.bancoHoras += resumo.bancoDepois;
    }

    return acc;
  }, {
    salario: 0,
    abono: 0,
    alimentacao: 0,
    transporte: 0,
    descontos: 0,
    sesi: 0,
    vale: 0,
    outros: 0,
    totalFolha: 0,
    saldoAcumulado: 0,
    saldoMes: 0,
    bancoHoras: 0,
  });

  return `
    <section class="timesheet-page model-page">
      <div class="timesheet-title model-title">
        <strong>MES DE REFERENCIA</strong>
        <span>${rotuloMesReferencia()}</span>
      </div>

      <div class="timesheet-employee">
        <strong></strong>
        <span>CCF CONSULTORES</span>
      </div>

      <div class="model-sheet-grid">
        <table class="timesheet-table">
          <thead>
            <tr>
              <th rowspan="2">DIA</th>
              <th rowspan="2"></th>
              <th colspan="2">Manha</th>
              <th colspan="2">Tarde</th>
              <th colspan="2">Horas Trabalhadas</th>
            </tr>
            <tr>
              <th>Hora</th>
              <th>Hora</th>
              <th>Hora</th>
              <th>Hora</th>
              <th>Horas</th>
              <th>Codigo</th>
            </tr>
          </thead>
          <tbody>${linhas}</tbody>
          <tfoot>
            <tr>
              <td colspan="6"><strong>Total</strong></td>
              <td><strong>${formatarHoras(totalHoras)}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="code-legend">
          <span class="code-1">Esquecimento</span>
          <span class="code-2">Atestado</span>
          <span class="code-3">Ferias</span>
          <span class="code-4">Sem Intervalo</span>
          <span class="code-5">Outros</span>
          <span class="code-6">Falta</span>
          <span class="code-7">Banco de Horas</span>
          <span class="holiday-code">Feriado</span>
        </div>
      </div>

      <div class="model-bottom">
        <table class="summary-table">
          <tbody>
            <tr><th>Salario</th><td>${formatarMoeda(totais.salario)}</td></tr>
            <tr><th>Abono</th><td>${formatarMoeda(totais.abono)}</td></tr>
            <tr><th>Alimentacao</th><td>${formatarMoeda(totais.alimentacao)}</td></tr>
            <tr><th>Transporte</th><td>${formatarMoeda(totais.transporte)}</td></tr>
            <tr><th>Descontos</th><td>${formatarMoeda(totais.descontos)}</td></tr>
            <tr><th>Sesi</th><td>${formatarMoeda(totais.sesi)}</td></tr>
            <tr><th>Vale</th><td>${formatarMoeda(totais.vale)}</td></tr>
            <tr><th>Outros</th><td>${formatarMoeda(totais.outros)}</td></tr>
            <tr class="summary-total"><th>TOTAL DA FOLHA DE PAGAMENTO</th><td>${formatarMoeda(totais.totalFolha)}</td></tr>
            <tr><th>Saldo de Horas Acumulado</th><td>${totais.saldoAcumulado.toFixed(2)}</td></tr>
            <tr><th>Saldo de Horas do Mes</th><td>${totais.saldoMes.toFixed(2)}</td></tr>
            <tr><th>Banco de Horas</th><td>${totais.bancoHoras.toFixed(2)}</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function montarFolhaPonto(email) {
  const funcionarios = carregarFuncionarios();
  const descontos = carregarDescontos();
  const funcionario = normalizarFuncionario(funcionarios[email], email);
  const folha = ultimaFolha[email];
  const resumo = calcularResumoFuncionario(email, folha, funcionario, descontos[chaveDesconto(email)] || {});
  const descontoManual = descontos[chaveDesconto(email)] || {};
  const grupos = registrosPorDia(folha.registros);
  const observacao = observacaoFuncionario(email) || "";
  const horasRegistradas = horasTotaisRegistros(folha);
  const horasModelo = funcionario.tipo === "mensalista" ? cargaPrevistaMensal(email) : resumo.horas;
  const acaoPagamentoHoras = bancoHorasAplicadoNaFolhaAtual() ? "" : `
    <div class="pay-hours-action">
      <button type="button" onclick="abrirPagamentoHoras('${email}')">Pagar / descontar horas</button>
    </div>
  `;
  const feriasNaFolha = feriasAfetamFolhaMes(email);
  let totalHoras = 0;

  const linhas = diasDoMes(ultimaFolhaMes, ultimaFolhaAno).map(({ dia, data, iso }) => {
    const registros = grupos[iso] || [];
    const manha = registroManha(registros);
    const tarde = registroTarde(registros);
    const diaCalendario = { data, iso };
    const util = diaUtilCalendario(diaCalendario);
    const feriado = diaUtilAlteradoParaNaoUtil(diaCalendario);
    const ausencias = periodosAusentesDia(registros, diaCalendario, funcionario);
    const codigoOriginal = codigoDia(registros);
    const feriasDia = codigoOriginal === 3 || (feriasNaFolha && diaFeriasNaFolha(email, diaCalendario));
    const codigo = feriasDia ? 3 : (codigoOriginal || (ausencias.total > 0 ? CODIGO_BANCO_HORAS : 0));
    const horasRegistradas = registros.reduce((total, registro) => total + Number(registro.horas || 0), 0);
    const feriadoPago = feriado && funcionario.tipo === "mensalista";
    const horasDia = feriasDia ? 0 : horasRegistradas + (feriadoPago ? JORNADA_DIARIA : 0);
    const manhaEntrada = feriasDia ? "00:00" : (ausencias.manha ? "00:00" : (manha.entrada || ""));
    const manhaSaida = feriasDia ? "00:00" : (ausencias.manha ? "00:00" : (manha.saida || ""));
    const tardeEntrada = feriasDia ? "00:00" : (ausencias.tarde ? "00:00" : (tarde.entrada || ""));
    const tardeSaida = feriasDia ? "00:00" : (ausencias.tarde ? "00:00" : (tarde.saida || ""));
    const classes = [
      util ? "" : "non-working-row",
      feriado ? "holiday-row" : "",
      codigo && !feriado ? `code-row code-${codigo}` : "",
    ].filter(Boolean).join(" ");
    totalHoras += horasDia;

    return `
        <tr class="${classes}">
          <td>${dia}</td>
          <td>${nomeDia(data)}</td>
        <td>${manhaEntrada}</td>
        <td>${manhaSaida}</td>
        <td>${tardeEntrada}</td>
        <td>${tardeSaida}</td>
          <td><strong>${formatarHoras(horasDia)}</strong></td>
          <td>${feriasDia ? 3 : (feriado ? 8 : (codigo || 0))}</td>
        </tr>
    `;
  }).join("");

  return `
    <section class="timesheet-page">
      <div class="timesheet-title">
        <strong>MES DE REFERENCIA</strong>
        <span>${rotuloMesReferencia()}</span>
      </div>

      <div class="timesheet-employee">
        <strong>NOME:</strong>
        <span>${funcionario.nome || email}</span>
        <strong>Cargo/Função:</strong>
        <span>${funcionario.cargo || ""}</span>
      </div>

      <table class="timesheet-table">
        <thead>
          <tr>
            <th rowspan="2">DIA</th>
            <th rowspan="2"></th>
            <th colspan="2">Manha</th>
            <th colspan="2">Tarde</th>
            <th colspan="2">Horas Trabalhada</th>
          </tr>
          <tr>
            <th>Hora</th>
            <th>Hora</th>
            <th>Hora</th>
            <th>Hora</th>
            <th>Horas</th>
            <th>Codigo</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
        <tfoot>
          <tr>
            <td colspan="6"><strong>Total</strong></td>
            <td><strong>${formatarHoras(totalHoras)}</strong></td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      ${acaoPagamentoHoras}

      <div class="timesheet-footer">

        <div class="summary-observacao-row">
          <div class="payroll-lines">
            <p><strong>Salario (VB)</strong><span>${formatarMoeda(resumo.salario)}</span></p>
            <p><strong>Abono</strong><span>${formatarMoeda(funcionario.abono)}</span></p>
            <p><strong>V. Alimentação</strong><span>${formatarMoeda(funcionario.valeAlimentacao)}</span></p>
            <p><strong>V. Transporte</strong><span>${formatarMoeda(funcionario.valeTransporte)}</span></p>
            <p><strong>Horas modelo</strong><span>${formatarHoras(horasModelo)}</span></p>
            <p><strong>B.H. Pagas</strong><span>${formatarHoras(resumo.horasPagas)}</span></p>
            <p><strong>Valor H. Pagas</strong><span>${formatarMoeda(resumo.valorHorasPagas)}</span></p>
            <p><strong>Valor (VB)</strong><span>${formatarMoeda(resumo.salario + resumo.abono + resumo.alimentacao + resumo.transporte + resumo.valorHorasPagas)}</span></p>
            <p><strong>Descontos</strong><span>${formatarMoeda(resumo.descontoBeneficios + resumo.descontosManuais)}</span></p>
            <p><strong>Adic. VA/VT</strong><span>${formatarMoeda(resumo.adicionalBeneficios)}</span></p>
            <p><strong>Sesi</strong><span>${formatarMoeda(descontoManual.sesi)}</span></p>
            <p><strong>Vale</strong><span>${formatarMoeda(descontoManual.vale)}</span></p>
            <p><strong>Outros(*)</strong><span>${formatarMoeda(descontoManual.outros)}</span></p>
            <p class="highlight-total"><strong>Salario / VL</strong><span>${formatarMoeda(resumo.total)}</span></p>
          </div>

          <div class="pay-hours-observacao right-column-observacao">
            <label for="observacaoFuncionario-${email}">Observação</label>
            <textarea id="observacaoFuncionario-${email}" rows="2" placeholder="Use até duas linhas" onblur="salvarObservacaoFuncionario('${email}')">${observacao}</textarea>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 15px;">
          
          <div style="flex: 1; margin-right: 20px;">
            <div style="text-align: center; margin-bottom: 10px; padding-top: 10px;">
              <strong>Banco de Horas</strong>
            </div>
            
            <div class="payroll-lines">
              <p><strong>Saldo</strong><span>${resumo.bancoAtual.toFixed(2)}h</span></p>
              <p><strong>Horas Mês</strong><span>${resumo.bancoMes.toFixed(2)}h</span></p>
              <p><strong>Saldo Atual</strong><span>${resumo.bancoDepois.toFixed(2)}h</span></p>
            </div>
          </div>

          <div class="signature" style="flex: 1; text-align: center; padding-top: 10px;">
            <span>São Bento do Sul, ${dataAssinaturaFolha()}</span>
            <br><br><br><br>
            <span class="signature-line" style="display: block; border-top: 1px solid #000; width: 80%; margin: 0 auto 5px auto;"></span>
            <strong>${funcionario.nome || email}</strong>
          </div>

        </div>
        
      </div>
    </section>
  `;
}

function aplicarBancoHorasFuncionarios() {
  const funcionarios = carregarFuncionarios();
  const descontos = carregarDescontos();

  emailsOrdenados().forEach((email) => {
    const funcionario = normalizarFuncionario(funcionarios[email], email);
    if (funcionario.tipo !== "mensalista") return;

    const folha = ultimaFolha[email];
    if (!folha) return;

    const resumo = calcularResumoFuncionario(email, folha, funcionario, descontos[chaveDesconto(email)] || {});
    funcionarios[email] = {
      ...funcionario,
      bancoHoras: Number(resumo.bancoDepois.toFixed(2)),
    };
  });

  gravarFuncionarios(funcionarios);
}

function criarSnapshotFolha(bancoHorasAplicado = false) {
  return {
    tipoHistorico: "folha",
    mes: ultimaFolhaMes,
    ano: ultimaFolhaAno,
    folha: ultimaFolha,
    funcionarios: carregarFuncionarios(),
    descontos: carregarDescontos(),
    calendarios: carregarCalendarios(),
    regrasBeneficios: carregarRegrasBeneficios(),
    horasPagas: carregarHorasPagas(),
    observacoes: carregarObservacoes(),
    bancoHorasAplicado,
    salvoEm: new Date().toISOString(),
  };
}

function tipoFeriasAtual() {
  const modo = modoReciboSelecionado();
  if (modo === "quitacao-ferias") return "quitacao";
  if (["decimo-terceiro-1", "decimo-terceiro-2"].includes(modo)) return modo;
  return "ferias";
}

function chaveHistoricoFerias(tipo) {
  if (["decimo-terceiro-1", "decimo-terceiro-2"].includes(tipo)) return `${tipo}-${Date.now()}`;
  return `${tipo === "quitacao" ? "quitacao-ferias" : "ferias"}-${Date.now()}`;
}

function criarSnapshotFerias(tipo = tipoFeriasAtual()) {
  if (["decimo-terceiro-1", "decimo-terceiro-2"].includes(tipo)) {
    const recibos = recibosDecimoProntos(tipo);

    return {
      tipoHistorico: tipo,
      titulo: tituloReciboDecimo(tipo),
      funcionarios: carregarFuncionarios(),
      descontos: carregarDescontos(),
      ano: Number(document.getElementById("ano").value || new Date().getFullYear()),
      mesesDecimo: mesesDecimoCache,
      feriasSelecionados: recibos.map((recibo) => recibo.email),
      recibos,
      salvoEm: new Date().toISOString(),
    };
  }

  const emails = tipo === "quitacao" ? emailsParaRecibosQuitacaoFerias() : emailsParaRecibosFerias();
  const dadosFerias = tipo === "quitacao" ? carregarQuitacaoFerias() : carregarFerias();
  const feriasSelecionadas = {};

  for (const email of emails) {
    feriasSelecionadas[email] = dadosFerias[email];
  }

  return {
    tipoHistorico: tipo === "quitacao" ? "quitacao-ferias" : "ferias",
    titulo: tipo === "quitacao" ? "Quitacao de Ferias" : "Ferias",
    funcionarios: carregarFuncionarios(),
    descontos: carregarDescontos(),
    ferias: tipo === "ferias" ? feriasSelecionadas : {},
    quitacaoFerias: tipo === "quitacao" ? feriasSelecionadas : {},
    feriasSelecionados: emails,
    recibos: recibosFeriasProntos(tipo),
    salvoEm: new Date().toISOString(),
  };
}

function salvarFeriasHistorico() {
  const tipo = tipoFeriasAtual();
  const snapshot = criarSnapshotFerias(tipo);

  if (snapshot.feriasSelecionados.length === 0) {
    document.getElementById("resultado").innerHTML = '<p class="status">Selecione funcionarios e complete as datas das ferias antes de salvar.</p>';
    return false;
  }

  const historico = carregarHistorico();
  historico[chaveHistoricoFerias(tipo)] = snapshot;
  gravarHistorico(historico);
  renderizarHistorico();
  return snapshot;
}

function salvarFolhaAtual(automatico = false) {
  if (modoFeriasSelecionado()) {
    const snapshot = salvarFeriasHistorico();
    if (!snapshot) return false;

    if (recibosFeriasZip) {
      salvarTodosRecibosFerias();
    }

    document.getElementById("resultado").insertAdjacentHTML("afterbegin", `<p class="status saved">${snapshot.titulo || "Documento"} salvo no historico.</p>`);
    return false;
  }

  if (Object.keys(ultimaFolha).length === 0) {
    document.getElementById("resultado").innerHTML = '<p class="status">Gere a folha antes de salvar.</p>';
    return false;
  }

  const historico = carregarHistorico();
  const chave = chaveFolha();

  // Conferencia antes de fechar: pendencias precisam de confirmacao explicita.
  const pendencias = resumoPendenciasConferencia();
  if (pendencias && !automatico) {
    const confirmar = confirm(`Ha pendencias na conferencia deste mes:\n${pendencias}\n\nFechar a folha mesmo assim?`);
    if (!confirmar) return false;
  }

  if (historico[chave] && !automatico) {
    const confirmar = confirm("Ja existe uma folha salva para este mes. Deseja substituir?");
    if (!confirmar) return false;
  }

  const bancoHorasJaAplicado = Boolean(historico[chave]?.bancoHorasAplicado);
  const deveAplicarBancoHoras = editarBancoHorasAtivoNoMes() && !bancoHorasJaAplicado;

  if (deveAplicarBancoHoras) {
    aplicarBancoHorasFuncionarios();
  }

  historico[chave] = criarSnapshotFolha(bancoHorasJaAplicado || deveAplicarBancoHoras);
  gravarHistorico(historico);
  // Copia dos pontos usados (CSV) no banco local: correcao posterior na fonte
  // nao muda esta folha sem aviso.
  registrarFechamentoFolha(chave);
  document.getElementById("resultado").insertAdjacentHTML("afterbegin", '<p class="status saved">Folha salva no historico.</p>');
  renderizarFuncionarios();
  renderizarLinksFolha();
  renderizarFolhaPonto();
  renderizarHistorico();
  return true;
}

function abrirFolhaHistorico(chave) {
  const historico = carregarHistorico();
  const item = historico[chave];
  if (!item) return;

  const lista = document.getElementById("listaHistorico");
  if (!lista) return;

  // Salvar estado global original para restauração
  const originalUltimaFolha = ultimaFolha;
  const originalMes = ultimaFolhaMes;
  const originalAno = ultimaFolhaAno;
  const backupFunc = carregarFuncionarios;
  const backupDesc = carregarDescontos;
  const backupCal = carregarCalendarios;
  const backupReg = carregarRegrasBeneficios;
  const backupPag = carregarHorasPagas;

  // Mock temporário das funções de carregamento para usar dados do snapshot sem afetar o banco real
  window.carregarFuncionarios = () => item.funcionarios || {};
  window.carregarDescontos = () => item.descontos || {};
  window.carregarCalendarios = () => item.calendarios || {};
  window.carregarRegrasBeneficios = () => item.regrasBeneficios || {};
  window.carregarHorasPagas = () => item.horasPagas || {};

  ultimaFolha = item.folha || {};
  ultimaFolhaMes = item.mes || "";
  ultimaFolhaAno = item.ano || "";
  folhaSelecionada = "todos";

  try {
    const isRecibo = ["ferias", "quitacao-ferias", "decimo-terceiro-1", "decimo-terceiro-2"].includes(item.tipoHistorico);
    const titulo = isRecibo ? (item.titulo || "Recibos") : `${String(item.mes).padStart(2, "0")}/${item.ano}`;

    lista.innerHTML = `
      <div class="no-print" style="margin-bottom: 20px; display: flex; align-items: center; gap: 15px; background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
        <button type="button" class="secondary-button" onclick="renderizarHistorico()" style="margin:0;">← Voltar para a lista</button>
        <h2 style="margin:0; flex:1;">Consulta Histórico: ${titulo}</h2>
        <button type="button" onclick="window.print()" style="margin:0;">Imprimir Consulta</button>
      </div>
      <div id="conteudoConsultaHistorico"></div>
    `;

    const destino = document.getElementById("conteudoConsultaHistorico");

    if (isRecibo) {
      const recibos = Array.isArray(item.recibos) ? item.recibos : [];
      destino.innerHTML = recibos.map((recibo) => {
        const d = recibo.dados || {};
        return `
          <section class="vacation-receipt-page" style="margin-bottom: 30px; border-bottom: 2px dashed #ccc; padding-bottom: 20px;">
            <div class="vacation-receipt-head"><strong>${recibo.titulo}</strong></div>
            <div class="vacation-receipt-grid">
              <p><strong>Funcionário</strong><span>${d.NomeFuncionario}</span></p>
              <p><strong>Cargo</strong><span>${d.CargoFuncionario || "-"}</span></p>
              <p><strong>Valor Líquido</strong><span>${d.TotalLiquido || d.SBMenosD}</span></p>
              <p><strong>Data</strong><span>${d.DataHoje || d.AnoReferencia || ""}</span></p>
            </div>
          </section>`;
      }).join("");
    } else {
      const emails = Object.keys(ultimaFolha).sort((a, b) => nomeFuncionario(a).localeCompare(nomeFuncionario(b), "pt-BR"));
      destino.innerHTML = emails.map(email => montarFolhaPonto(email)).join("");
    }
  } finally {
    // Restaurar funções originais para manter o funcionamento da aba Folha intacto
    window.carregarFuncionarios = backupFunc;
    window.carregarDescontos = backupDesc;
    window.carregarCalendarios = backupCal;
    window.carregarRegrasBeneficios = backupReg;
    window.carregarHorasPagas = backupPag;
    ultimaFolha = originalUltimaFolha;
    ultimaFolhaMes = originalMes;
    ultimaFolhaAno = originalAno;
  }
}

function abrirFeriasHistorico(item) {
  // Unificado na função abrirFolhaHistorico para evitar redundância e navegação indesejada
  const historico = carregarHistorico();
  const chave = Object.keys(historico).find(k => historico[k].salvoEm === item.salvoEm);
  if (chave) abrirFolhaHistorico(chave);
}

function renderizarHistorico() {
  const lista = document.getElementById("listaHistorico");
  if (!lista) return;

  const historico = carregarHistorico();
  const chaves = Object.keys(historico).sort().reverse();

  if (chaves.length === 0) {
    lista.innerHTML = '<p class="status">Nenhuma folha salva ainda.</p>';
    return;
  }

  lista.innerHTML = chaves.map((chave) => {
    const item = historico[chave];
    const itemFerias = ["ferias", "quitacao-ferias", "decimo-terceiro-1", "decimo-terceiro-2"].includes(item.tipoHistorico);
    const quantidade = itemFerias ? (item.feriasSelecionados || item.recibos || []).length : Object.keys(item.folha || {}).length;
    const salvoEm = item.salvoEm ? new Date(item.salvoEm).toLocaleString("pt-BR") : "";
    const titulo = itemFerias ? (item.titulo || "Ferias") : `${String(item.mes).padStart(2, "0")}/${item.ano}`;
    const descricao = itemFerias
      ? `${quantidade} funcionario(s) | salvo em ${salvoEm}`
      : `${quantidade} funcionario(s) | salvo em ${salvoEm}`;

    return `
      <article class="employee-row">
        <div>
          <strong>${titulo}</strong>
          <span>${descricao}</span>
        </div>
        <div class="row-actions">
          <button type="button" onclick="abrirFolhaHistorico('${chave}')">Consultar</button>
          <button class="danger-button" type="button" onclick="apagarFolhaHistorico('${chave}')">Excluir</button>
        </div>
      </article>
    `;
  }).join("");
}

function apagarFolhaHistorico(chave) {
  const historico = carregarHistorico();
  const item = historico[chave];
  if (!item) return;

  const referencia = ["ferias", "quitacao-ferias", "decimo-terceiro-1", "decimo-terceiro-2"].includes(item.tipoHistorico)
    ? (item.titulo || "Ferias")
    : `${String(item.mes).padStart(2, "0")}/${item.ano}`;
  const confirmar = confirm(`Tem certeza que deseja apagar ${referencia} do historico?`);

  if (!confirmar) return;

  delete historico[chave];
  gravarHistorico(historico);
  renderizarHistorico();
}

function salvarFuncionario(event) {
  event.preventDefault();

  const funcionarios = carregarFuncionarios();
  const emailOriginal = document.getElementById("funcionarioOriginalEmail").value;
  const email = document.getElementById("funcionarioEmail").value.trim().toLowerCase();
  const funcionarioAtual = emailOriginal ? normalizarFuncionario(funcionarios[emailOriginal], emailOriginal) : normalizarFuncionario(funcionarios[email], email);

  if (emailOriginal && emailOriginal !== email) delete funcionarios[emailOriginal];

  funcionarios[email] = {
    email,
    funcionario: document.getElementById("funcionarioCodigo").value.trim(),
    nome: document.getElementById("funcionarioNome").value.trim(),
    cargo: document.getElementById("funcionarioCargo").value.trim(),
    tipo: document.getElementById("funcionarioTipo").value,
    salario: valorCampo("funcionarioSalario"),
    bancoHoras: valorCampo("funcionarioBancoHoras"),
    abono: valorCampo("funcionarioAbono"),
    valeAlimentacao: valorCampo("funcionarioValeAlimentacao"),
    valeTransporte: valorCampo("funcionarioValeTransporte"),
    inativo: Boolean(funcionarioAtual.inativo),
    desligadoEm: funcionarioAtual.desligadoEm || "",
  };

  gravarFuncionarios(funcionarios);
  limparFormularioFuncionario();
  renderizarFuncionarios();
  renderizarSelectFerias();
  if (Object.keys(ultimaFolha).length > 0) {
    renderizarLinksFolha();
    renderizarResumoFolha();
    renderizarFolhaPonto();
  }
}

function alternarModoFuncionarios(modo) {
  modoFuncionarios = modo === "inativos" ? "inativos" : "ativos";
  document.getElementById("modoFuncionariosAtivosBotao")?.classList.toggle("active", modoFuncionarios === "ativos");
  document.getElementById("modoFuncionariosInativosBotao")?.classList.toggle("active", modoFuncionarios === "inativos");
  limparFormularioFuncionario();
  renderizarFuncionarios();
}

function editarFuncionario(email) {
  const funcionario = normalizarFuncionario(carregarFuncionarios()[email], email);

  document.getElementById("funcionarioOriginalEmail").value = email;
  document.getElementById("funcionarioEmail").value = funcionario.email;
  document.getElementById("funcionarioCodigo").value = funcionario.funcionario || "";
  document.getElementById("funcionarioNome").value = funcionario.nome || "";
  document.getElementById("funcionarioCargo").value = funcionario.cargo || "";
  document.getElementById("funcionarioTipo").value = funcionario.tipo || "mensalista";
  document.getElementById("funcionarioSalario").value = funcionario.salario || 0;
  document.getElementById("funcionarioBancoHoras").value = funcionario.bancoHoras || 0;
  document.getElementById("funcionarioAbono").value = funcionario.abono || 0;
  document.getElementById("funcionarioValeAlimentacao").value = funcionario.valeAlimentacao || 0;
  document.getElementById("funcionarioValeTransporte").value = funcionario.valeTransporte || 0;
}

function excluirFuncionario(email) {
  const funcionarios = carregarFuncionarios();
  delete funcionarios[email];
  gravarFuncionarios(funcionarios);
  renderizarFuncionarios();
  renderizarSelectFerias();
}

function desligarFuncionario(email) {
  const funcionarios = carregarFuncionarios();
  const funcionario = normalizarFuncionario(funcionarios[email], email);
  const confirmar = confirm(`Deseja mover ${funcionario.nome || email} para funcionarios inativos?`);

  if (!confirmar) return;

  funcionarios[email] = {
    ...funcionario,
    inativo: true,
    desligadoEm: new Date().toISOString(),
  };

  gravarFuncionarios(funcionarios);
  limparFormularioFuncionario();
  renderizarFuncionarios();
  renderizarSelectFerias();
}

function reativarFuncionario(email) {
  const funcionarios = carregarFuncionarios();
  const funcionario = normalizarFuncionario(funcionarios[email], email);

  funcionarios[email] = {
    ...funcionario,
    inativo: false,
    desligadoEm: "",
  };

  gravarFuncionarios(funcionarios);
  renderizarFuncionarios();
  renderizarSelectFerias();
}

function limparFormularioFuncionario() {
  document.getElementById("funcionarioOriginalEmail").value = "";
  document.getElementById("funcionarioEmail").value = "";
  document.getElementById("funcionarioCodigo").value = "";
  document.getElementById("funcionarioNome").value = "";
  document.getElementById("funcionarioCargo").value = "";
  document.getElementById("funcionarioTipo").value = "mensalista";
  document.getElementById("funcionarioSalario").value = "";
  document.getElementById("funcionarioBancoHoras").value = 0;
  document.getElementById("funcionarioAbono").value = 0;
  document.getElementById("funcionarioValeAlimentacao").value = 0;
  document.getElementById("funcionarioValeTransporte").value = 0;
}

function inicializarFerias() {
  const campoAno = document.getElementById("feriasAnoReferencia");
  if (campoAno && !campoAno.value) campoAno.value = anoFeriasSelecionado;
  renderizarSelectFerias();
  renderizarTabelaFerias();
}

function alterarAnoFerias() {
  const campoAno = document.getElementById("feriasAnoReferencia");
  anoFeriasSelecionado = Number(campoAno?.value || new Date().getFullYear());
  feriasEmailEmEdicao = "";
  document.getElementById("statusFerias").innerHTML = "";
  renderizarTabelaFerias();
}

function alterarAnoEditorFerias() {
  const campoAno = document.getElementById("feriasAno");
  anoFeriasSelecionado = Number(campoAno?.value || anoFeriasSelecionado);
  const campoAnoReferencia = document.getElementById("feriasAnoReferencia");
  if (campoAnoReferencia) campoAnoReferencia.value = anoFeriasSelecionado;
  renderizarCalendariosFerias();
}

function alternarModoTabelaFerias(modo) {
  modoTabelaFerias = modo === "quitacao" ? "quitacao" : "ferias";
  feriasEmailEmEdicao = "";
  document.getElementById("modoFeriasBotao")?.classList.toggle("active", modoTabelaFerias === "ferias");
  document.getElementById("modoQuitacaoFeriasBotao")?.classList.toggle("active", modoTabelaFerias === "quitacao");
  document.getElementById("statusFerias").innerHTML = "";
  renderizarTabelaFerias();
}

function renderizarSelectFerias() {
  const lista = document.getElementById("feriasFuncionarios");
  if (!lista) return;

  const selecionados = new Set(carregarFeriasSelecionados());
  const funcionarios = carregarFuncionarios();
  const emails = Object.keys(funcionarios)
    .filter((email) => !funcionarioInativo(funcionarios[email]))
    .sort((a, b) => nomeFuncionario(a).localeCompare(nomeFuncionario(b), "pt-BR"));

  if (emails.length === 0) {
    lista.innerHTML = '<p class="status">Nenhum funcionario cadastrado.</p>';
    return;
  }

  lista.innerHTML = emails.map((email) => {
    const funcionario = normalizarFuncionario(funcionarios[email], email);
    const marcado = selecionados.has(email) ? "checked" : "";
    return `
      <label class="vacation-check">
        <input type="checkbox" value="${email}" ${marcado} onchange="alternarFuncionarioFerias()">
        <span>${funcionario.nome || email}</span>
      </label>
    `;
  }).join("");
}

function carregarFeriasDoFuncionario() {
  const ferias = dadosFeriasDoModoAtual(feriasEmailEmEdicao);
  const campoIda = document.getElementById("feriasIda");
  const campoVolta = document.getElementById("feriasVolta");
  const campoDias = document.getElementById("feriasDias");
  const campoMesInicial = document.getElementById("feriasMesInicial");
  const campoAno = document.getElementById("feriasAno");
  if (!campoIda || !campoVolta || !campoDias) return;

  if (campoMesInicial && !campoMesInicial.value) {
    campoMesInicial.value = ferias?.ida ? dataLocalPorIso(ferias.ida).getMonth() + 1 : mesInicialFeriasPadrao();
  }

  if (campoAno && !campoAno.value) {
    campoAno.value = anoCalendarioFeriasPadrao(ferias);
  }

  campoIda.value = ferias?.ida || "";
  campoVolta.value = ferias?.volta || "";
  campoDias.value = modoTabelaFerias === "quitacao" ? diasSaldoFerias(feriasEmailEmEdicao) : (ferias?.dias || "");
  document.getElementById("statusFerias").innerHTML = "";
  etapaSelecaoFerias = ferias?.ida && ferias?.volta ? "ida" : "volta";
  renderizarCalendariosFerias();
}

function emailsFeriasSelecionados() {
  const funcionarios = carregarFuncionarios();
  return carregarFeriasSelecionados()
    .filter((email) => funcionarios[email] && !funcionarioInativo(funcionarios[email]))
    .sort((a, b) => nomeFuncionario(a).localeCompare(nomeFuncionario(b), "pt-BR"));
}

function alternarFuncionarioFerias() {
  const emails = Array.from(document.querySelectorAll("#feriasFuncionarios input[type='checkbox']:checked"))
    .map((campo) => campo.value);
  gravarFeriasSelecionados(emails);
  if (!emails.includes(feriasEmailEmEdicao)) feriasEmailEmEdicao = "";
  document.getElementById("statusFerias").innerHTML = "";
  renderizarTabelaFerias();
}

function alternarMenuFerias() {
  document.getElementById("feriasFuncionarios")?.classList.toggle("active");
}

document.addEventListener("click", (event) => {
  const menu = document.getElementById("feriasFuncionarios");
  const botao = document.querySelector(".vacation-select-toggle");
  if (!menu || !botao) return;
  if (menu.contains(event.target) || botao.contains(event.target)) return;
  menu.classList.remove("active");
});

function renderizarTabelaFerias() {
  const corpo = document.getElementById("feriasTabelaFuncionarios");
  if (!corpo) return;

  const funcionarios = carregarFuncionarios();
  const emails = emailsFeriasSelecionados();

  if (emails.length === 0) {
    corpo.innerHTML = '<tr><td colspan="8" class="empty-cell">Clique em Funcionarios e selecione quem deve aparecer.</td></tr>';
    return;
  }

  corpo.innerHTML = emails.map((email) => {
    const funcionario = normalizarFuncionario(funcionarios[email], email);
    const ferias = dadosFeriasDoModoAtual(email);
    const salario = Number(funcionario.salario || 0);
    const diasTabela = modoTabelaFerias === "quitacao" ? diasSaldoFerias(email) : 30;
    const baseTabela = salario * (diasTabela / 30);
    const terco = baseTabela / 3;
    const aberta = feriasEmailEmEdicao === email;
    const retorno = ferias.retorno || proximoDiaUtilFerias(ferias.volta);
    const podeEditar = modoTabelaFerias === "ferias" || diasTabela > 0;
    const diasPeriodo = Number(ferias.dias || 0) || (ferias.ida && ferias.volta ? diasEntreInclusivo(ferias.ida, ferias.volta) : 0);
    const diasExibidos = diasPeriodo || (modoTabelaFerias === "quitacao" ? diasTabela : "");
    return `
      <tr>
        <td>${funcionario.nome || email}</td>
        <td>${formatarMoeda(baseTabela)}</td>
        <td>${formatarMoeda(terco)}</td>
        <td>${formatarMoeda(baseTabela + terco)}</td>
        <td><button class="secondary-button vacation-date-button" type="button" ${podeEditar ? `onclick="abrirEditorFerias('${email}')"` : "disabled"}>${ferias.ida ? formatarDataCurta(ferias.ida) : "dd/mm/aaaa"}</button></td>
        <td class="vacation-days-cell">${diasExibidos || "-"}</td>
        <td><button class="secondary-button vacation-date-button" type="button" ${podeEditar ? `onclick="abrirEditorFerias('${email}')"` : "disabled"}>${ferias.volta ? formatarDataCurta(ferias.volta) : "dd/mm/aaaa"}</button></td>
        <td id="${idRetornoFerias(email)}" class="vacation-return-cell">${retorno ? formatarDataCurta(retorno) : "dd/mm/aaaa"}</td>
      </tr>
      ${aberta ? renderizarEditorFerias(email) : ""}
    `;
  }).join("");

  if (feriasEmailEmEdicao) carregarFeriasDoFuncionario();
}

function formatarDataCurta(iso) {
  return iso ? iso.split("-").reverse().join("/") : "";
}

function idRetornoFerias(email) {
  return `feriasRetorno-${email.replace(/[^a-z0-9_-]/gi, "_")}`;
}

function nomeMes(mes) {
  return [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ][Number(mes) - 1] || "";
}

function diaUtilFerias(data) {
  return diaUtilPadrao(data) && !nomeFeriadoNacional(isoDaData(data));
}

function proximoDiaUtilFerias(iso) {
  if (!iso) return "";

  let data = adicionarDias(dataLocalPorIso(iso), 1);
  while (!diaUtilFerias(data)) {
    data = adicionarDias(data, 1);
  }

  return isoDaData(data);
}

function mesJaIncluidoFerias(meses, mes, ano) {
  return meses.some((mesInfo) => mesInfo.mes === mes && mesInfo.ano === ano);
}

function mesInicialFeriasPadrao() {
  return modoTabelaFerias === "quitacao" ? 6 : 12;
}

function anoCalendarioFeriasPadrao(ferias) {
  const dataBase = dataLocalPorIso(ferias?.ida) || new Date(Number(anoFeriasSelecionado), 0, 1);
  return dataBase.getFullYear();
}

function opcoesMesesFerias(mesSelecionado) {
  return Array.from({ length: 12 }, (_, index) => {
    const mes = index + 1;
    const selecionado = mes === Number(mesSelecionado) ? "selected" : "";
    return `<option value="${mes}" ${selecionado}>${nomeMes(mes)}</option>`;
  }).join("");
}

function abrirEditorFerias(email) {
  feriasEmailEmEdicao = feriasEmailEmEdicao === email ? "" : email;
  document.getElementById("statusFerias").innerHTML = "";
  renderizarTabelaFerias();
}

function renderizarEditorFerias(email) {
  const ferias = dadosFeriasDoModoAtual(email);
  const diasFixos = modoTabelaFerias === "quitacao" ? diasSaldoFerias(email) : 0;
  const dataIda = dataLocalPorIso(ferias.ida);
  const mesInicial = dataIda ? dataIda.getMonth() + 1 : mesInicialFeriasPadrao();
  const anoInicial = anoCalendarioFeriasPadrao(ferias);
  const temFeriasSalvas = Boolean(ferias.ida || ferias.volta);
  return `
    <tr class="vacation-editor-row">
      <td colspan="8">
        <form class="vacation-search vacation-inline-editor" onsubmit="confirmarFerias(event)">
          <label>
            Ida
            <input type="date" id="feriasIda" required oninput="atualizarFeriasPorIda()">
          </label>

          <label>
            Volta
            <input type="date" id="feriasVolta" ${modoTabelaFerias === "quitacao" ? "disabled" : 'oninput="atualizarFeriasPorVolta()"'}>
          </label>

          <label>
            Dias
            <input type="number" id="feriasDias" min="1" step="1" value="${diasFixos || ""}" ${modoTabelaFerias === "quitacao" ? "disabled" : 'oninput="atualizarFeriasPorDias()"'}>
          </label>

          <label>
            Mes inicial
            <select id="feriasMesInicial" onchange="renderizarCalendariosFerias()">
              ${opcoesMesesFerias(mesInicial)}
            </select>
          </label>

          <label>
            Ano
            <input type="number" id="feriasAno" min="2000" max="2100" value="${anoInicial}" onchange="alterarAnoEditorFerias()">
          </label>

          <div class="vacation-editor-actions">
            <button type="submit">Confirmar</button>
            <button class="danger-button" type="button" onclick="excluirFeriasSelecionadas()" ${temFeriasSalvas ? "" : "disabled"}>Excluir</button>
          </div>
        </form>

        <div id="calendariosFerias" class="vacation-calendars"></div>
      </td>
    </tr>
  `;
}

function atualizarFeriasPorIda() {
  const ida = document.getElementById("feriasIda").value;
  const volta = document.getElementById("feriasVolta").value;
  const dias = modoTabelaFerias === "quitacao" ? diasSaldoFerias(feriasEmailEmEdicao) : Number(document.getElementById("feriasDias").value || 0);

  etapaSelecaoFerias = "volta";

  if (ida && dias > 0) {
    document.getElementById("feriasVolta").value = isoDaData(adicionarDias(dataLocalPorIso(ida), dias - 1));
  } else if (ida && volta) {
    document.getElementById("feriasDias").value = diasEntreInclusivo(ida, volta) || "";
  }

  renderizarCalendariosFerias();
}

function atualizarFeriasPorVolta() {
  const ida = document.getElementById("feriasIda").value;
  const volta = document.getElementById("feriasVolta").value;
  document.getElementById("feriasDias").value = diasEntreInclusivo(ida, volta) || "";
  etapaSelecaoFerias = "ida";
  renderizarCalendariosFerias();
}

function atualizarFeriasPorDias() {
  const ida = document.getElementById("feriasIda").value;
  const dias = Number(document.getElementById("feriasDias").value || 0);

  if (ida && dias > 0) {
    document.getElementById("feriasVolta").value = isoDaData(adicionarDias(dataLocalPorIso(ida), dias - 1));
  }

  etapaSelecaoFerias = "volta";
  renderizarCalendariosFerias();
}

function selecionarDiaFerias(iso) {
  const campoIda = document.getElementById("feriasIda");
  const campoVolta = document.getElementById("feriasVolta");

  if (modoTabelaFerias === "quitacao") {
    const dias = diasSaldoFerias(feriasEmailEmEdicao);
    campoIda.value = iso;
    campoVolta.value = dias > 0 ? isoDaData(adicionarDias(dataLocalPorIso(iso), dias - 1)) : "";
    document.getElementById("feriasDias").value = dias || "";
    etapaSelecaoFerias = "ida";
    renderizarCalendariosFerias();
    return;
  }

  if (!campoIda.value || etapaSelecaoFerias === "ida") {
    campoIda.value = iso;
    campoVolta.value = "";
    document.getElementById("feriasDias").value = "";
    etapaSelecaoFerias = "volta";
  } else if (iso < campoIda.value) {
    campoIda.value = iso;
    campoVolta.value = "";
    document.getElementById("feriasDias").value = "";
    etapaSelecaoFerias = "volta";
  } else {
    campoVolta.value = iso;
    document.getElementById("feriasDias").value = diasEntreInclusivo(campoIda.value, campoVolta.value);
    etapaSelecaoFerias = "ida";
  }

  renderizarCalendariosFerias();
}

function feriasFuncionarioSelecionado() {
  if (!feriasEmailEmEdicao) return null;
  return dadosFeriasDoModoAtual(feriasEmailEmEdicao);
}

function renderizarCalendariosFerias() {
  const destino = document.getElementById("calendariosFerias");
  const campoMesInicial = document.getElementById("feriasMesInicial");
  const campoAno = document.getElementById("feriasAno");
  if (!destino || !campoMesInicial || !campoAno) return;

  const mesInicial = Number(campoMesInicial.value || mesInicialFeriasPadrao());
  const anoInicial = Number(campoAno.value || new Date().getFullYear());
  const segundoMes = mesInicial === 12 ? 1 : mesInicial + 1;
  const anoSegundoMes = mesInicial === 12 ? anoInicial + 1 : anoInicial;
  const meses = [
    { mes: mesInicial, ano: anoInicial, titulo: `${nomeMes(mesInicial)} ${anoInicial}` },
    { mes: segundoMes, ano: anoSegundoMes, titulo: `${nomeMes(segundoMes)} ${anoSegundoMes}` },
  ];
  const ida = document.getElementById("feriasIda")?.value || "";
  const volta = document.getElementById("feriasVolta")?.value || "";
  const retorno = proximoDiaUtilFerias(volta);
  const salvo = feriasFuncionarioSelecionado();
  const dataRetorno = dataLocalPorIso(retorno);
  const campoRetorno = feriasEmailEmEdicao ? document.getElementById(idRetornoFerias(feriasEmailEmEdicao)) : null;

  if (campoRetorno) {
    campoRetorno.textContent = retorno ? formatarDataCurta(retorno) : "dd/mm/aaaa";
  }

  if (dataRetorno) {
    const mesRetorno = dataRetorno.getMonth() + 1;
    const anoRetorno = dataRetorno.getFullYear();
    if (!mesJaIncluidoFerias(meses, mesRetorno, anoRetorno)) {
      meses.push({ mes: mesRetorno, ano: anoRetorno, titulo: `${nomeMes(mesRetorno)} ${anoRetorno}` });
    }
  }

  destino.innerHTML = meses.map((mesInfo) => `
    <article class="vacation-month">
      <h2>${mesInfo.titulo}</h2>
      <div class="vacation-weekdays">
        ${["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((dia) => `<span>${dia}</span>`).join("")}
      </div>
      <div class="vacation-calendar">
        ${renderizarDiasFerias(mesInfo.mes, mesInfo.ano, ida, volta, retorno, salvo)}
      </div>
    </article>
  `).join("");
}

function renderizarDiasFerias(mes, ano, ida, volta, retorno, salvo) {
  const primeiroDia = new Date(ano, mes - 1, 1).getDay();
  const vazios = Array.from({ length: primeiroDia }, () => '<span class="vacation-empty"></span>');
  const retornoSalvo = salvo?.retorno || proximoDiaUtilFerias(salvo?.volta);
  const dias = diasDoMes(mes, ano).map((dia) => {
    const noPeriodo = ida && volta && dia.iso >= ida && dia.iso <= volta;
    const inicio = dia.iso === ida;
    const fim = dia.iso === volta;
    const diaRetorno = dia.iso === retorno || (!retorno && dia.iso === retornoSalvo);
    const salvoNoPeriodo = salvo?.ida && salvo?.volta && dia.iso >= salvo.ida && dia.iso <= salvo.volta;
    const classes = [
      dia.data.getDay() === 0 || dia.data.getDay() === 6 ? "weekend" : "",
      noPeriodo ? "selected-range" : "",
      inicio ? "selected-start" : "",
      fim ? "selected-end" : "",
      diaRetorno ? "return-day" : "",
      salvoNoPeriodo ? "saved-range" : "",
    ].filter(Boolean).join(" ");

    return `
      <button class="${classes}" type="button" onclick="selecionarDiaFerias('${dia.iso}')">
        <strong>${dia.dia}</strong>
        ${diaRetorno ? "<span>Retorno</span>" : ""}
      </button>
    `;
  });

  return vazios.concat(dias).join("");
}

function confirmarFerias(event) {
  event.preventDefault();

  const ida = document.getElementById("feriasIda").value;
  const volta = document.getElementById("feriasVolta").value;
  const dias = modoTabelaFerias === "quitacao" ? diasSaldoFerias(feriasEmailEmEdicao) : diasEntreInclusivo(ida, volta);
  const status = document.getElementById("statusFerias");

  if (!feriasEmailEmEdicao || !ida || !volta || dias <= 0) {
    status.innerHTML = '<p class="status error">Escolha um funcionario e preencha ida, volta e dias corretamente.</p>';
    return;
  }

  const ferias = modoTabelaFerias === "quitacao" ? carregarQuitacaoFerias() : carregarFerias();
  const retorno = proximoDiaUtilFerias(volta);
  ferias[feriasEmailEmEdicao] = {
    email: feriasEmailEmEdicao,
    anoReferencia: Number(anoFeriasSelecionado),
    ida,
    volta,
    retorno,
    dias,
    salvoEm: new Date().toISOString(),
  };
  if (modoTabelaFerias === "quitacao") {
    gravarQuitacaoFerias(ferias);
  } else {
    gravarFerias(ferias);
  }

  status.innerHTML = `<p class="status saved">${modoTabelaFerias === "quitacao" ? "Quitacao de ferias" : "Ferias"} confirmada para ${nomeFuncionario(feriasEmailEmEdicao)}: ${dias} dias, de ${formatarDataCurta(ida)} ate ${formatarDataCurta(volta)}. Retorno em ${formatarDataCurta(retorno)}.</p>`;
  feriasEmailEmEdicao = "";
  renderizarTabelaFerias();
}

function excluirFeriasSelecionadas() {
  const status = document.getElementById("statusFerias");
  if (!feriasEmailEmEdicao) return;

  const ferias = modoTabelaFerias === "quitacao" ? carregarQuitacaoFerias() : carregarFerias();
  const registro = ferias[feriasEmailEmEdicao];

  if (!registro?.ida && !registro?.volta) {
    status.innerHTML = '<p class="status">Nenhum periodo salvo para excluir.</p>';
    return;
  }

  const nome = nomeFuncionario(feriasEmailEmEdicao);
  delete ferias[feriasEmailEmEdicao];

  if (modoTabelaFerias === "quitacao") {
    gravarQuitacaoFerias(ferias);
  } else {
    gravarFerias(ferias);
  }

  status.innerHTML = `<p class="status saved">${modoTabelaFerias === "quitacao" ? "Quitacao de ferias" : "Ferias"} excluida para ${nome}.</p>`;
  feriasEmailEmEdicao = "";
  renderizarTabelaFerias();
}

function renderizarFuncionarios() {
  const lista = document.getElementById("listaFuncionarios");
  const funcionarios = carregarFuncionarios();
  const mostrarInativos = modoFuncionarios === "inativos";
  const emails = Object.keys(funcionarios)
    .filter((email) => funcionarioInativo(funcionarios[email]) === mostrarInativos)
    .sort((a, b) => nomeFuncionario(a).localeCompare(nomeFuncionario(b), "pt-BR"));

  if (!lista) return;

  if (emails.length === 0) {
    lista.innerHTML = mostrarInativos
      ? '<p class="status">Nenhum funcionario inativo.</p>'
      : '<p class="status">Nenhum funcionario cadastrado. Gere uma folha ou cadastre manualmente.</p>';
    return;
  }

  lista.innerHTML = emails.map((email) => {
    const funcionario = normalizarFuncionario(funcionarios[email], email);
    const rotuloSalario = funcionario.tipo === "horista" ? "Valor hora" : "Salario mensal";
    const extras = Number(funcionario.abono || 0) + Number(funcionario.valeAlimentacao || 0) + Number(funcionario.valeTransporte || 0);

    return `
      <article class="employee-row">
        <div>
          <strong>${funcionario.nome || email}</strong>
          <span>${email}</span>
          ${funcionario.funcionario ? `<span>Funcionario: ${funcionario.funcionario}</span>` : ""}
          <span>${funcionario.cargo || "Cargo/Função não informado"}</span>
        </div>
        <div>
          <span>${funcionario.tipo}</span>
          <strong>${rotuloSalario}: ${formatarMoeda(funcionario.salario)}</strong>
          <span>Extras: ${formatarMoeda(extras)} | Banco: ${Number(funcionario.bancoHoras || 0).toFixed(2)}h</span>
        </div>
        <div class="row-actions">
          <button class="secondary-button" type="button" onclick="editarFuncionario('${email}')">Editar</button>
          ${mostrarInativos
            ? `<button type="button" onclick="reativarFuncionario('${email}')">Reativar</button>
               <button class="danger-button" type="button" onclick="excluirFuncionario('${email}')">Excluir</button>`
            : `<button class="danger-button" type="button" onclick="desligarFuncionario('${email}')">Desligar</button>`}
        </div>
      </article>
    `;
  }).join("");
}

function abrirDescontosImpressao(folhaNova = false) {
  const modoRecibo = ["ferias", "quitacao", "decimo-terceiro-1", "decimo-terceiro-2"].includes(modoDescontos);

  if (!modoRecibo && Object.keys(ultimaFolha).length === 0) {
    document.getElementById("resultado").innerHTML = '<p class="status">Gere a folha antes de preencher descontos.</p>';
    return;
  }

  if (!modoRecibo && !folhaNova && carregarHistorico()[chaveFolha()]) return;

  const funcionarios = carregarFuncionarios();
  const descontos = carregarDescontos();
  const corpo = document.getElementById("descontosFuncionarios");
  const aviso = modoRecibo
    ? `<p class="status">${tituloModoDescontos()}: preencha os descontos antes de gerar os documentos.</p>`
    : (folhaNova ? '<p class="status">Folha nova: preencha os descontos antes de salvar ou imprimir.</p>' : "");
  const emails = modoDescontos === "quitacao"
    ? emailsParaRecibosQuitacaoFerias()
    : (modoDescontos === "ferias"
      ? emailsParaRecibosFerias()
      : (modoDecimoDescontos() ? emailsParaRecibosDecimo() : emailsOrdenados()));

  corpo.innerHTML = aviso + emails.map((email) => {
    const funcionario = normalizarFuncionario(funcionarios[email], email);
    const ferias = modoDescontos === "quitacao" ? (carregarQuitacaoFerias()[email] || {}) : (carregarFerias()[email] || {});
    const chave = modoDecimoDescontos()
      ? chaveDescontoReciboDecimo(email, modoDescontos, document.getElementById("ano").value)
      : (["ferias", "quitacao"].includes(modoDescontos) ? chaveDescontoReciboFerias(email, ferias, modoDescontos) : chaveDesconto(email));
    const desconto = descontos[chave] || {};

    return `
      <article class="discount-row" data-email="${email}" data-desconto-chave="${chave}">
        <div>
          <strong>${funcionario.nome || email}</strong>
          <span>${email}</span>
        </div>
        <label>Sesi<input type="number" step="0.01" min="0" data-tipo="sesi" value="${Number(desconto.sesi || 0)}"></label>
        <label>Vale<input type="number" step="0.01" min="0" data-tipo="vale" value="${Number(desconto.vale || 0)}"></label>
        <label>Outros<input type="number" step="0.01" min="0" data-tipo="outros" value="${Number(desconto.outros || 0)}"></label>
      </article>
    `;
  }).join("");

  document.getElementById("modalDescontos").classList.add("active");
  const botaoSalvar = document.getElementById("botaoSalvarDescontos");
  if (botaoSalvar) botaoSalvar.textContent = modoRecibo ? "Gerar recibos" : "Salvar";
  atualizarSwitchBeneficios();
  atualizarSwitchBancoHoras();
  renderizarCalendarioUtil();
}

function renderizarCalendarioUtil() {
  const destino = document.getElementById("calendarioUtil");
  if (!destino || !ultimaFolhaMes || !ultimaFolhaAno) return;

  destino.innerHTML = diasDoMes(ultimaFolhaMes, ultimaFolhaAno).map((dia) => {
    const util = diaUtilCalendario(dia);
    const calendario = calendarioDoMes();
    const ajusteManual = typeof calendario[dia.iso] === "boolean";
    const nomeFeriado = nomeFeriadoNacional(dia.iso);
    const classes = [
      util ? "workday" : "offday",
      nomeFeriado ? "national-holiday" : "",
      ajusteManual ? "manual-adjustment" : "",
    ].filter(Boolean).join(" ");
    const rotulo = nomeFeriado || (ajusteManual ? "Ajuste manual" : "");

    return `
      <button
        class="${classes}"
        type="button"
        onclick="alternarDiaCalendario('${dia.iso}')"
        title="${rotulo}"
      >
        <strong>${dia.dia}</strong>
        <span>${nomeDia(dia.data)}</span>
        ${rotulo ? `<small>${rotulo}</small>` : ""}
      </button>
    `;
  }).join("");
}

function fecharDescontosImpressao() {
  document.getElementById("modalDescontos").classList.remove("active");
}

function salvarDescontos() {
  const descontos = carregarDescontos();

  document.querySelectorAll(".discount-row").forEach((linha) => {
    const email = linha.dataset.email;
    const valores = {};

    linha.querySelectorAll("input").forEach((input) => {
      valores[input.dataset.tipo] = Number(input.value || 0);
    });

    descontos[linha.dataset.descontoChave || chaveDesconto(email)] = valores;
  });

  gravarDescontos(descontos);
  fecharDescontosImpressao();

  if (["ferias", "quitacao"].includes(modoDescontos)) {
    gerarRecibosFerias(modoDescontos);
    return;
  }

  if (modoDecimoDescontos()) {
    gerarRecibosDecimo(modoDescontos);
    return;
  }

  renderizarResumoFolha();
  renderizarFolhaPonto();
}

function salvarDescontosModal() {
  if (["ferias", "quitacao"].includes(modoDescontos)) {
    salvarDescontos();
    return;
  }

  if (modoDecimoDescontos()) {
    salvarDescontos();
    return;
  }

  salvarDescontos();
}

function imprimir() {
  if (modoFeriasSelecionado()) {
    if (recibosFeriasGerados.length === 0) {
      document.getElementById("resultado").innerHTML = '<p class="status">Gere os recibos de ferias antes de imprimir.</p>';
      return;
    }

    window.print();
    return;
  }

  if (Object.keys(ultimaFolha).length === 0) {
    document.getElementById("resultado").innerHTML = '<p class="status">Gere a folha antes de imprimir.</p>';
    return;
  }

  if (!carregarHistorico()[chaveFolha()]) {
    salvarFolhaAtual(true);
  }

  window.print();
}

function salvarPdfFolhaPonto() {
  if (modoFeriasSelecionado()) {
    imprimir();
    return;
  }

  if (Object.keys(ultimaFolha).length === 0) {
    document.getElementById("resultado").innerHTML = '<p class="status">Gere a folha antes de salvar em PDF.</p>';
    return;
  }

  window.print();
}

window.onload = async () => {
  await inicializarDadosBanco();

  const hoje = new Date();

  document.getElementById("mes").value = hoje.getMonth() + 1;
  document.getElementById("ano").value = hoje.getFullYear();
  atualizarModoGeracao();
  // Garante que a lógica de férias seja atualizada ao mudar o ano na aba Folha
  document.getElementById("ano")?.addEventListener("change", atualizarModoGeracao);
  renderizarFuncionarios();
  inicializarFerias();
  renderizarHistorico();
};
