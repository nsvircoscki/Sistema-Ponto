// Calculo do salario-base da folha. Roda no navegador (window.CalculoFolha,
// usado pelo script.js) e no Node (testes).
//
// O valor da hora / salario vem SEMPRE do cadastro local (sis-ponto.db). As
// colunas "Hourly Wage" e "Total Wages" do CSV nunca entram aqui: no CSV do
// CCF elas vem vazias/zeradas, e na planilha "Total Wages" e codigo de ocorrencia.
(function (raiz) {
  function horasTotaisRegistros(folha) {
    return ((folha && folha.registros) || []).reduce((total, registro) => total + Number(registro.horas || 0), 0);
  }

  // horista: horas trabalhadas x valor da hora local.
  // mensalista: o salario mensal ja proporcionalizado (ferias) por quem chama.
  function salarioDoMes({ tipo, salarioBase, horas, salarioMensalista }) {
    return (tipo || "horista") === "mensalista" ? Number(salarioMensalista || 0) : Number(horas || 0) * Number(salarioBase || 0);
  }

  const api = { horasTotaisRegistros, salarioDoMes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.CalculoFolha = api;
})(typeof window !== "undefined" ? window : globalThis);
