const express = require("express");
const path = require("path");
const fs = require("fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

const { baixarPlanilha } = require("./baixarplanilha");
const { lerTextoCSV } = require("./lerCSV");
const { calcularHoras, listarPendenciasRegistros, lerData } = require("./calculo");
const { resolverRegistros } = require("./conciliacao");
const { diffAuditoria, operadorAtual } = require("./auditoria");
const { obterPontos, obterPendenciasFonte, nomeFonte, sha256 } = require("./fontesPontos");
const {
  buscarTodosDados,
  buscarDado,
  salvarDadoComAuditoria,
  salvarVariosDados,
  registrarAuditoria,
  listarAuditoria,
  listarVinculos,
  salvarVinculo,
  removerVinculo,
  buscarFechamento,
  salvarFechamento,
  buscarPontosImportados,
  salvarPontosImportados,
} = require("./database");

const app = express();

// Sem CORS de propósito: as telas são servidas por este mesmo servidor, e com
// cors() aberto qualquer site aberto no navegador deste PC conseguia ler os
// salários pela API. Pelo mesmo motivo o servidor só escuta no próprio PC.
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => res.redirect("/dashboard.html"));

app.use(express.static(path.join(__dirname, "public")));

app.get("/api/dados", (req, res) => {
  try {
    res.json(buscarTodosDados());
  } catch (err) {
    console.error("Erro ao buscar dados:", err);
    res.status(500).json({ erro: "Erro ao buscar dados" });
  }
});

app.put("/api/dados/:chave", (req, res) => {
  try {
    const chave = req.params.chave;
    const novo = req.body?.dados;
    // Salario, descontos e folhas salvas/apagadas ficam registrados na auditoria.
    salvarDadoComAuditoria(chave, novo, diffAuditoria(chave, buscarDado(chave), novo));
    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro ao salvar dado:", err);
    res.status(500).json({ erro: "Erro ao salvar dado" });
  }
});

app.post("/api/dados/migrar", (req, res) => {
  try {
    const dados = req.body?.dados || {};
    salvarVariosDados(dados);
    registrarAuditoria({ quem: operadorAtual(), acao: "migracao_localstorage", chave: Object.keys(dados).join(",") });
    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro ao migrar dados:", err);
    res.status(500).json({ erro: "Erro ao migrar dados" });
  }
});

// ---- Pontos do mes -------------------------------------------------------

const chaveMes = (mes, ano) => `${ano}-${String(mes).padStart(2, "0")}`;

// Ultimos pontos servidos por mes (o que a tela usou para montar a folha).
// E isso que vai para folha_fechamento quando a folha e salva.
const pontosServidos = new Map();

// Mes ja fechado usa a copia gravada no fechamento, a nao ser que a pessoa
// peca explicitamente os dados atuais (?atualizar=1).
async function carregarPontosDoMes(mes, ano, { atualizar = false } = {}) {
  const fechamento = buscarFechamento(chaveMes(mes, ano));
  const pontos = fechamento && !atualizar
    ? { csv: fechamento.csv, origem: fechamento.origem, baixadoEm: fechamento.baixado_em, sha256: fechamento.sha256, daFolhaFechada: true }
    : await baixarPlanilha({ mes, ano });
  pontosServidos.set(chaveMes(mes, ano), pontos);
  return pontos;
}

function prepararRegistros(csv) {
  const registros = lerTextoCSV(csv);
  const funcionariosLocais = buscarDado("sis-ponto-funcionarios") || {};
  return { registros, funcionariosLocais, ...resolverRegistros(registros, listarVinculos(), funcionariosLocais) };
}

function registrosDoMes(registros, mes, ano) {
  return registros.filter((r) => {
    const data = lerData(r.entrada || r.saida || "");
    return data.isValid() && data.month() + 1 === Number(mes) && data.year() === Number(ano);
  });
}

// Compara duas versoes dos pontos de um mes, linha a linha.
function diferencaPontos(csvAntigo, csvNovo, mes, ano) {
  const chaves = (csv) => new Set(registrosDoMes(lerTextoCSV(csv), mes, ano).map((r) => JSON.stringify([r.ccfId || r.email, r.entrada, r.saida, r.codigo])));
  const antigo = chaves(csvAntigo);
  const novo = chaves(csvNovo);
  return {
    adicionadas: [...novo].filter((k) => !antigo.has(k)).length,
    removidas: [...antigo].filter((k) => !novo.has(k)).length,
  };
}

// Qual fonte esta ativa e, para FONTE_PONTOS=arquivo, o que ja foi importado no mes.
app.get("/api/pontos/fonte", (req, res) => {
  try {
    const fonte = nomeFonte();
    const importado = fonte === "arquivo" && req.query.mes && req.query.ano
      ? buscarPontosImportados(chaveMes(req.query.mes, req.query.ano))
      : null;
    res.json({
      fonte,
      importado: importado ? { nomeArquivo: importado.nome_arquivo, importadoEm: importado.importado_em, importadoPor: importado.importado_por } : null,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// Recebe o CSV exportado do SisCCF (corpo da requisicao, texto) para o mes/ano.
app.post("/api/pontos/importar", express.text({ type: "*/*", limit: "20mb" }), (req, res) => {
  try {
    if (nomeFonte() !== "arquivo") {
      return res.status(400).json({ erro: "Para importar o CSV, configure FONTE_PONTOS=arquivo no .env e reinicie o sistema." });
    }
    const mes = Number(req.query.mes);
    const ano = Number(req.query.ano);
    if (!(mes >= 1 && mes <= 12) || !ano) return res.status(400).json({ erro: "Escolha o mes e o ano antes de importar." });

    const csv = String(req.body || "");
    let registros;
    try {
      registros = lerTextoCSV(csv);
    } catch (err) {
      return res.status(400).json({ erro: `Nao foi possivel ler o CSV: ${err.message}` });
    }
    if (!registros.length) return res.status(400).json({ erro: "O arquivo nao tem nenhuma linha de ponto." });
    if (!registros.some((r) => r.email && (r.entrada || r.saida))) {
      return res.status(400).json({ erro: "Nao encontrei as colunas de ponto (Name/Email, Time In/Entrada, Time Out/Saida) no arquivo." });
    }

    const linhasDoMes = registrosDoMes(registros, mes, ano).length;
    if (!linhasDoMes) {
      return res.status(400).json({ erro: `O arquivo nao tem nenhum ponto de ${String(mes).padStart(2, "0")}/${ano}. Confira o mes escolhido.` });
    }

    salvarPontosImportados({ mes: chaveMes(mes, ano), csv, sha256: sha256(csv), nomeArquivo: req.query.arquivo, quem: operadorAtual() });
    res.json({ sucesso: true, linhas: registros.length, linhasDoMes });
  } catch (err) {
    console.error("Erro ao importar pontos:", err);
    res.status(500).json({ erro: err.message || "Erro ao importar pontos" });
  }
});

app.get("/relatorio", async (req, res) => {
  try {
    const hoje = new Date();
    const mes = Number(req.query.mes || hoje.getMonth() + 1);
    const ano = Number(req.query.ano || hoje.getFullYear());

    const pontos = await carregarPontosDoMes(mes, ano, { atualizar: req.query.atualizar === "1" });
    const { registros, resolvidos, naoConciliados } = prepararRegistros(pontos.csv);
    // Funcionario do CCF ainda nao vinculado fica FORA da soma e aparece na
    // conferencia (/conferencia), nunca e ignorado em silencio.
    const resultado = calcularHoras(resolvidos, mes, ano);

    console.log(`Relatorio ${mes}/${ano} (fonte: ${pontos.origem}${pontos.daFolhaFechada ? ", copia da folha fechada" : ""})`);
    console.log(`Registros lidos: ${registros.length}`);
    console.log(`Funcionarios encontrados: ${Object.keys(resultado).length}`);
    if (naoConciliados.length) console.log(`Funcionarios do CCF sem vinculo: ${naoConciliados.length}`);

    res.json(resultado);
  } catch (err) {
    console.error("Erro:", err);
    res.status(500).json({ erro: err.message || "Erro ao processar dados" });
  }
});

// Tudo o que precisa ser conferido antes de fechar a folha do mes.
app.get("/conferencia", async (req, res) => {
  try {
    const hoje = new Date();
    const mes = Number(req.query.mes || hoje.getMonth() + 1);
    const ano = Number(req.query.ano || hoje.getFullYear());
    const chave = chaveMes(mes, ano);

    const pontos = pontosServidos.get(chave) || await carregarPontosDoMes(mes, ano);
    const { registros, resolvidos, naoConciliados, funcionariosLocais } = prepararRegistros(pontos.csv);
    const fechamento = buscarFechamento(chave);

    let alteracaoAposFechamento = null;
    if (fechamento) {
      try {
        const atual = await obterPontos({ mes, ano });
        alteracaoAposFechamento = atual.sha256 === fechamento.sha256
          ? { mudou: false }
          : { mudou: true, ...diferencaPontos(fechamento.csv, atual.csv, mes, ano) };
        if (alteracaoAposFechamento.mudou && !alteracaoAposFechamento.adicionadas && !alteracaoAposFechamento.removidas) {
          alteracaoAposFechamento = { mudou: false };
        }
      } catch (err) {
        alteracaoAposFechamento = { erro: err.message };
      }
    }

    // Quem aparece na folha sem cadastro local (ou com salario zerado) sairia
    // com valor zero sem ninguem perceber.
    const folha = calcularHoras(resolvidos, mes, ano);
    const semSalario = Object.keys(folha).filter((email) => !Number(funcionariosLocais[email]?.salario));

    res.json({
      mes: chave,
      origem: pontos.origem,
      baixadoEm: pontos.baixadoEm,
      usandoCopiaDaFolhaFechada: Boolean(pontos.daFolhaFechada),
      fechamento: fechamento ? { fechadoEm: fechamento.fechado_em, fechadoPor: fechamento.fechado_por, origem: fechamento.origem } : null,
      alteracaoAposFechamento,
      naoConciliados,
      pendenciasRegistros: listarPendenciasRegistros(registros, mes, ano),
      semSalario,
      ccf: pontos.origem === "ccf" ? await obterPendenciasFonte({ mes, ano }) : null,
    });
  } catch (err) {
    console.error("Erro na conferencia:", err);
    res.status(500).json({ erro: err.message || "Erro ao montar a conferencia" });
  }
});

// Fecha a folha: grava a copia dos pontos usados na folha deste mes.
app.post("/api/folhas/:mes/fechar", (req, res) => {
  try {
    const mes = req.params.mes;
    const pontos = pontosServidos.get(mes);
    if (!pontos) {
      return res.status(409).json({ erro: "Gere a folha deste mes antes de fecha-la (os pontos usados nao estao carregados)." });
    }
    salvarFechamento({ mes, origem: pontos.origem, csv: pontos.csv, sha256: pontos.sha256, baixadoEm: pontos.baixadoEm, quem: operadorAtual() });
    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro ao fechar folha:", err);
    res.status(500).json({ erro: "Erro ao fechar folha" });
  }
});

// ---- Vinculo CCF -> cadastro local ---------------------------------------

app.get("/api/vinculos", (req, res) => {
  res.json(listarVinculos());
});

app.post("/api/vinculos", (req, res) => {
  try {
    const { ccfId, emailLocal, emailCcf } = req.body || {};
    const funcionariosLocais = buscarDado("sis-ponto-funcionarios") || {};
    if (!Object.prototype.hasOwnProperty.call(funcionariosLocais, emailLocal)) {
      return res.status(400).json({ erro: "Cadastro local nao encontrado para esse e-mail." });
    }
    salvarVinculo({ ccfId, emailLocal, emailCcf, quem: operadorAtual() });
    res.json({ sucesso: true });
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

app.delete("/api/vinculos/:ccfId", (req, res) => {
  const removido = removerVinculo(req.params.ccfId, operadorAtual());
  if (!removido) return res.status(404).json({ erro: "Vinculo nao encontrado." });
  res.json({ sucesso: true });
});

app.get("/api/auditoria", (req, res) => {
  res.json(listarAuditoria(req.query.limite));
});

app.get("/decimo-terceiro/meses", async (req, res) => {
  try {
    const hoje = new Date();
    const ano = Number(req.query.ano || hoje.getFullYear());
    const mesesPorEmail = {};

    const pontos = await baixarPlanilha({ ano });
    // Funcionario do CCF conta pelo cadastro local vinculado (por ID).
    const { resolvidos } = prepararRegistros(pontos.csv);

    resolvidos.forEach((registro) => {
      if (!registro.email || !registro.entrada) return;

      const entrada = lerData(registro.entrada);
      if (!entrada.isValid() || entrada.year() !== ano) return;

      if (!mesesPorEmail[registro.email]) {
        mesesPorEmail[registro.email] = {
          funcionario: registro.funcionario || "",
          meses: [],
        };
      }

      if (!mesesPorEmail[registro.email].funcionario && registro.funcionario) {
        mesesPorEmail[registro.email].funcionario = registro.funcionario;
      }

      const mes = entrada.month() + 1;
      if (!mesesPorEmail[registro.email].meses.includes(mes)) {
        mesesPorEmail[registro.email].meses.push(mes);
      }
    });

    Object.keys(mesesPorEmail).forEach((email) => {
      mesesPorEmail[email].meses.sort((a, b) => a - b);
      mesesPorEmail[email].totalMeses = mesesPorEmail[email].meses.length;
    });

    res.json(mesesPorEmail);
  } catch (err) {
    console.error("Erro ao calcular meses do decimo terceiro:", err);
    res.status(500).json({ erro: "Erro ao calcular meses trabalhados" });
  }
});

app.post("/recibos-ferias", (req, res) => {
  try {
    const recibos = Array.isArray(req.body.recibos) ? req.body.recibos : [];
    const modelos = {
      ferias: "Recibo de Férias.docx",
      "quitacao-ferias": "Recibo de Quitação do Saldo de Férias.docx",
      "decimo-terceiro-1": "ReciboDecimoTerceiro1Par.docx",
      "decimo-terceiro-2": "ReciboDecimoTerceiro2Par.docx",
    };
    const modeloSelecionado = modelos[req.body.modelo] ? req.body.modelo : "ferias";
    const nomeModelo = modelos[modeloSelecionado];
    const modeloPath = path.join(__dirname, nomeModelo);

    if (recibos.length === 0) {
      return res.status(400).json({ erro: "Nenhum recibo informado" });
    }

    if (!fs.existsSync(modeloPath)) {
      return res.status(404).json({ erro: `Modelo ${nomeModelo} nao encontrado` });
    }

    const modelo = fs.readFileSync(modeloPath, "binary");
    const zipTodos = new PizZip();
    const arquivos = recibos.map((recibo, index) => {
      const doc = new Docxtemplater(new PizZip(modelo), {
        paragraphLoop: true,
        linebreaks: true,
      });
      const nomeArquivo = recibo.nomeArquivo || `recibo-ferias-${index + 1}.docx`;

      doc.render(recibo.dados || {});

      const buffer = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
      });

      zipTodos.file(nomeArquivo, buffer);

      return {
        nomeArquivo,
        conteudo: buffer.toString("base64"),
      };
    });

    const zipBuffer = zipTodos.generate({
      type: "nodebuffer",
      compression: "DEFLATE",
    });

    res.json({
      arquivos,
      zip: {
        nomeArquivo: `recibos-${modeloSelecionado}.zip`,
        conteudo: zipBuffer.toString("base64"),
      },
    });
  } catch (err) {
    console.error("Erro ao gerar recibos de ferias:", err);
    res.status(500).json({ erro: "Erro ao gerar recibos de ferias" });
  }
});

const PORT = Number(process.env.PORT) || 3000;

// HOST=127.0.0.1 (padrão): só este computador acessa. Outro valor (ex.:
// 0.0.0.0) abre para a rede — só faça isso se souber quem está nela.
const HOST = process.env.HOST || "127.0.0.1";
app.listen(PORT, HOST, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`);
});
