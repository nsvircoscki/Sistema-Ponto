// Liga o funcionario do CCF (coluna "CCF ID") ao cadastro local, que e
// indexado por e-mail (sis-ponto-funcionarios). O vinculo e por ID e fica na
// tabela vinculo_ccf: se a pessoa mudar de e-mail no CCF, a folha continua
// achando o cadastro certo (com o salario certo).
//
// Linhas da planilha do Google (sem "CCF ID") passam como sempre: pelo e-mail.

const normalizarEmail = (email) => String(email || "").trim().toLowerCase();

// registros: saida do lerCSV. vinculos: { [ccfId]: { email_local, ... } }.
// funcionariosLocais: objeto sis-ponto-funcionarios (chave = e-mail).
// -> { resolvidos, naoConciliados: [{ ccfId, emailCcf, linhas, sugestaoEmailLocal }] }
function resolverRegistros(registros, vinculos, funcionariosLocais) {
  const resolvidos = [];
  const pendentes = new Map();

  const emailsLocais = new Map(Object.keys(funcionariosLocais || {}).map((email) => [normalizarEmail(email), email]));

  registros.forEach((registro) => {
    if (!registro.ccfId) {
      resolvidos.push(registro);
      return;
    }

    const vinculo = vinculos[registro.ccfId];
    if (vinculo) {
      resolvidos.push({ ...registro, email: vinculo.email_local, emailCcf: registro.email });
      return;
    }

    if (!pendentes.has(registro.ccfId)) {
      pendentes.set(registro.ccfId, {
        ccfId: registro.ccfId,
        emailCcf: registro.email || "",
        linhas: 0,
        // So sugere; quem confirma e a pessoa da folha (um clique).
        sugestaoEmailLocal: emailsLocais.get(normalizarEmail(registro.email)) || null,
      });
    }
    pendentes.get(registro.ccfId).linhas += 1;
  });

  return { resolvidos, naoConciliados: [...pendentes.values()] };
}

module.exports = { resolverRegistros, normalizarEmail };
