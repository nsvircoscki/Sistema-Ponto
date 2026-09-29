const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const dayjs = require("dayjs");
const customParseFormat = require("dayjs/plugin/customParseFormat");

const { baixarPlanilha } = require("./baixarplanilha");
const { lerCSV } = require("./lerCSV");
const { calcularHoras } = require("./calculo");
const { buscarTodosDados, salvarDado, salvarVariosDados } = require("./database");

const app = express();
dayjs.extend(customParseFormat);

app.use(cors());
app.use(express.json());

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
    salvarDado(req.params.chave, req.body?.dados);
    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro ao salvar dado:", err);
    res.status(500).json({ erro: "Erro ao salvar dado" });
  }
});

app.post("/api/dados/migrar", (req, res) => {
  try {
    salvarVariosDados(req.body?.dados || {});
    res.json({ sucesso: true });
  } catch (err) {
    console.error("Erro ao migrar dados:", err);
    res.status(500).json({ erro: "Erro ao migrar dados" });
  }
});

app.get("/relatorio", async (req, res) => {
  try {
    const hoje = new Date();
    const mes = Number(req.query.mes || hoje.getMonth() + 1);
    const ano = Number(req.query.ano || hoje.getFullYear());

    await baixarPlanilha();

    const registros = lerCSV("./dados.csv");
    const resultado = calcularHoras(registros, mes, ano);

    console.log(`Relatorio ${mes}/${ano}`);
    console.log(`Registros lidos: ${registros.length}`);
    console.log(`Funcionarios encontrados: ${Object.keys(resultado).length}`);

    res.json(resultado);
  } catch (err) {
    console.error("Erro:", err);
    res.status(500).json({ erro: "Erro ao processar dados" });
  }
});

function lerDataRegistro(valor) {
  return dayjs(valor, ["M/D/YYYY H:mm:ss", "M/D/YYYY HH:mm:ss", "YYYY-MM-DD HH:mm:ss"], true);
}

app.get("/decimo-terceiro/meses", async (req, res) => {
  try {
    const hoje = new Date();
    const ano = Number(req.query.ano || hoje.getFullYear());
    const mesesPorEmail = {};

    await baixarPlanilha();

    lerCSV().forEach((registro) => {
      if (!registro.email || !registro.entrada) return;

      const entrada = lerDataRegistro(registro.entrada);
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

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`);
});
