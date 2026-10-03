// Calcula o que registrar na auditoria quando a tela grava uma chave do
// app_data (PUT /api/dados/:chave). A tela sempre manda o objeto inteiro;
// aqui so vira linha de log o que mudou de fato.
const os = require("os");

const CHAVE_FUNCIONARIOS = "sis-ponto-funcionarios";
const CHAVE_DESCONTOS = "sis-ponto-descontos";
const CHAVE_HISTORICO = "sis-ponto-historico-folhas";

// Campos com efeito em dinheiro no cadastro do funcionario.
const CAMPOS_MONETARIOS = ["salario", "tipo", "abono", "valeAlimentacao", "valeTransporte", "inativo", "bancoHoras"];

// O app nao tem login: "quem" e o operador configurado ou o usuario do Windows.
function operadorAtual() {
  if (process.env.OPERADOR_FOLHA) return process.env.OPERADOR_FOLHA;
  try {
    return os.userInfo().username;
  } catch {
    return "desconhecido";
  }
}

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function diffAuditoria(chave, antigo, novo, quem = operadorAtual()) {
  const entradas = [];
  const a = antigo || {};
  const n = novo || {};

  if (chave === CHAVE_FUNCIONARIOS) {
    new Set([...Object.keys(a), ...Object.keys(n)]).forEach((email) => {
      CAMPOS_MONETARIOS.forEach((campo) => {
        const va = a[email]?.[campo];
        const vn = n[email]?.[campo];
        if (!igual(va, vn)) {
          entradas.push({ quem, acao: `funcionario.${campo}`, chave: email, valorAntigo: va ?? null, valorNovo: vn ?? null });
        }
      });
    });
  } else if (chave === CHAVE_DESCONTOS) {
    new Set([...Object.keys(a), ...Object.keys(n)]).forEach((item) => {
      if (!igual(a[item], n[item])) {
        entradas.push({ quem, acao: "desconto", chave: item, valorAntigo: a[item] ?? null, valorNovo: n[item] ?? null });
      }
    });
  } else if (chave === CHAVE_HISTORICO) {
    // O snapshot inteiro e grande demais para o log: registra so quando cada
    // folha/recibo foi salvo, substituido ou apagado.
    new Set([...Object.keys(a), ...Object.keys(n)]).forEach((item) => {
      if (igual(a[item], n[item])) return;
      const acao = !a[item] ? "historico.salvo" : (!n[item] ? "historico.apagado" : "historico.substituido");
      entradas.push({ quem, acao, chave: item, valorAntigo: a[item]?.salvoEm ?? null, valorNovo: n[item]?.salvoEm ?? null });
    });
  }

  return entradas;
}

module.exports = { diffAuditoria, operadorAtual };
