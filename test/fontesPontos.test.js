const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { obterPontos, obterPendenciasFonte, sha256 } = require("../fontesPontos");

const TOKEN = "token-de-teste-com-mais-de-32-caracteres";
const csvCcf = fs.readFileSync(path.join(__dirname, "fixtures", "ccf-2026-10.csv"), "utf8");
let servidor;
const pedidos = [];

// Servidor falso no lugar do CCF.
before(async () => {
  servidor = http.createServer((req, res) => {
    pedidos.push({ url: req.url, auth: req.headers.authorization });
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      res.writeHead(401).end();
      return;
    }
    if (req.url.startsWith("/api/sis-ponto/export.csv")) {
      res.writeHead(200, { "Content-Type": "text/csv" }).end(csvCcf);
    } else if (req.url.startsWith("/api/sis-ponto/export-pendencias.json")) {
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ dispositivos: [{ deviceId: "d1", pendentes: 2 }] }));
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  process.env.FONTE_PONTOS = "ccf";
  process.env.CCF_PONTO_URL = `http://127.0.0.1:${servidor.address().port}/api/sis-ponto/`;
  process.env.CCF_EXPORT_TOKEN = TOKEN;
});

after(() => {
  servidor.close();
  delete process.env.FONTE_PONTOS;
});

test("fonte CCF manda o token no header e pede o mes certo", async () => {
  const pontos = await obterPontos({ mes: 10, ano: 2026 });
  assert.equal(pontos.origem, "ccf");
  assert.equal(pontos.csv, csvCcf);
  assert.equal(pontos.sha256, sha256(csvCcf));
  const pedido = pedidos.at(-1);
  assert.equal(pedido.url, "/api/sis-ponto/export.csv?mes=2026-10");
  assert.equal(pedido.auth, `Bearer ${TOKEN}`);
});

test("fonte CCF por ano (13o salario)", async () => {
  await obterPontos({ ano: 2026 });
  assert.equal(pedidos.at(-1).url, "/api/sis-ponto/export.csv?ano=2026");
});

test("pendencias dos aparelhos vem do CCF", async () => {
  const pendencias = await obterPendenciasFonte({ mes: 10, ano: 2026 });
  assert.equal(pendencias.dispositivos[0].pendentes, 2);
});

test("token errado vira mensagem clara", async () => {
  process.env.CCF_EXPORT_TOKEN = "errado";
  await assert.rejects(() => obterPontos({ mes: 10, ano: 2026 }), /recusou o token/);
  process.env.CCF_EXPORT_TOKEN = TOKEN;
});

test("FONTE_PONTOS invalida e recusada", async () => {
  process.env.FONTE_PONTOS = "xyz";
  await assert.rejects(() => obterPontos({ mes: 10, ano: 2026 }), /FONTE_PONTOS invalida/);
  process.env.FONTE_PONTOS = "ccf";
});
