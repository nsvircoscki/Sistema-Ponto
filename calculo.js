const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");

dayjs.extend(customParseFormat);

function lerData(valor) {
  return dayjs(valor, ["M/D/YYYY H:mm:ss", "M/D/YYYY HH:mm:ss", "YYYY-MM-DD HH:mm:ss"], true);
}

function calcularHoras(registros, mes, ano) {
  const resultado = {};
  const mesFiltro = Number(mes);
  const anoFiltro = Number(ano);

  registros.forEach((r) => {
    if (!r.email || !r.entrada) return;

    const entrada = lerData(r.entrada);

    if (!entrada.isValid()) return;
    if (mesFiltro && entrada.month() + 1 !== mesFiltro) return;
    if (anoFiltro && entrada.year() !== anoFiltro) return;

    if (!resultado[r.email]) {
      resultado[r.email] = {
        funcionario: r.funcionario || "",
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

    if (!resultado[r.email].funcionario && r.funcionario) {
      resultado[r.email].funcionario = r.funcionario;
    }

    const registroDia = {
      data: entrada.format("YYYY-MM-DD"),
      entrada: entrada.format("HH:mm"),
      saida: "",
      horas: 0,
      codigo: r.codigo,
    };

    if (r.saida) {
      const saida = lerData(r.saida);

      if (saida.isValid()) {
        const horas = saida.diff(entrada, "minute") / 60;
        resultado[r.email].horas += horas;
        registroDia.saida = saida.format("HH:mm");
        registroDia.horas = horas;
      }
    }

    resultado[r.email].registros.push(registroDia);

    // regras
    if (r.codigo === 1) resultado[r.email].esquecimentos++;
    if (r.codigo === 2) resultado[r.email].atestados++;
    if (r.codigo === 3) resultado[r.email].ferias++;
    if (r.codigo === 4) resultado[r.email].semIntervalo++;
    if (r.codigo === 5) resultado[r.email].outros++;
    if (r.codigo === 6) resultado[r.email].faltas++;

    if ([2, 3, 6].includes(r.codigo)) {
      resultado[r.email].descontoBeneficios++;
    }
  });

  return resultado;
}

// Linhas do mes que precisam de conferencia antes de fechar a folha. Nada e
// descartado em silencio: o calcularHoras ignora linha sem entrada valida e
// conta 0h para linha sem saida; aqui elas aparecem com o motivo.
// O mes da linha e o da entrada; sem entrada valida, o da saida.
function listarPendenciasRegistros(registros, mes, ano) {
  const pendencias = [];
  const mesFiltro = Number(mes);
  const anoFiltro = Number(ano);

  registros.forEach((r) => {
    const entrada = r.entrada ? lerData(r.entrada) : null;
    const saida = r.saida ? lerData(r.saida) : null;
    const referencia = entrada?.isValid() ? entrada : (saida?.isValid() ? saida : null);

    if (referencia) {
      if (mesFiltro && referencia.month() + 1 !== mesFiltro) return;
      if (anoFiltro && referencia.year() !== anoFiltro) return;
    }

    const motivos = [];
    if (!r.email) motivos.push("SEM_EMAIL");
    if (!r.entrada) motivos.push("SEM_ENTRADA");
    else if (!entrada.isValid()) motivos.push("ENTRADA_INVALIDA");
    if (!r.saida) motivos.push("SEM_SAIDA");
    else if (!saida.isValid()) motivos.push("SAIDA_INVALIDA");
    if (entrada?.isValid() && saida?.isValid() && saida.isBefore(entrada)) motivos.push("SAIDA_ANTES_DA_ENTRADA");
    String(r.observacao || "").split(";").filter(Boolean).forEach((obs) => {
      if (!motivos.includes(obs)) motivos.push(obs);
    });

    if (motivos.length) {
      pendencias.push({ email: r.email || "", ccfId: r.ccfId || null, entrada: r.entrada || "", saida: r.saida || "", motivos });
    }
  });

  return pendencias;
}

module.exports = { calcularHoras, listarPendenciasRegistros, lerData };
