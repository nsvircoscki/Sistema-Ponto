# Sistema de Ponto

Sistema local para controle de ponto e folha de pagamento. Ele lê os registros de entrada e saída de uma planilha do Google Sheets, calcula as horas trabalhadas por funcionário e gera os recibos de férias e de 13º salário em Word.

## Funcionalidades

- **Folha de pagamento**: gera a folha do mês com as horas de cada funcionário. A folha pode ser impressa, salva em PDF ou guardada no histórico.
- **Funcionários**: cadastro de funcionários ativos e inativos.
- **Férias**: geração dos recibos de férias e de quitação do saldo de férias.
- **13º salário**: cálculo dos meses trabalhados no ano e geração dos recibos da 1ª e da 2ª parcela.
- **Descontos**: calendário do mês para lançar faltas, atestados, férias e outras ocorrências.
- **Pagar horas**: registro do pagamento de horas extras.
- **Histórico**: consulta das folhas salvas.

## Requisitos

- [Node.js](https://nodejs.org/) **22.13 ou superior**. O projeto usa o módulo nativo `node:sqlite`, que não existe em versões mais antigas.

## Instalação

1. Clone o repositório e instale as dependências:

   ```
   npm install
   ```

2. Crie o arquivo `.env` a partir do modelo e coloque nele o link de exportação CSV da planilha:

   ```
   copy .env.example .env
   ```

   ```
   PLANILHA_URL=https://docs.google.com/spreadsheets/d/SEU_ID_AQUI/export?format=csv
   ```

3. Copie os modelos de recibo para a raiz do projeto. Eles não ficam no repositório:

   - `Recibo de Férias.docx`
   - `Recibo de Quitação do Saldo de Férias.docx`
   - `ReciboDecimoTerceiro1Par.docx`
   - `ReciboDecimoTerceiro2Par.docx`

## Como usar

No Windows, dê dois cliques em **`Iniciar-Sistema.bat`**. O servidor sobe e o navegador abre sozinho em `http://localhost:3000`.

Também dá para iniciar pelo terminal:

```
node index.js
```

Depois é só acessar `http://localhost:3000`.

## Planilha de ponto

Toda vez que um relatório é gerado, o sistema baixa a planilha e salva uma cópia local em `dados.csv`. A planilha precisa ter as colunas:

| O | Name | Time In | Time Out | Total Hours | Hourly Wage | Total Wages |
|---|------|---------|----------|-------------|-------------|-------------|

As datas devem estar no formato `M/D/YYYY H:mm:ss`, por exemplo `11/27/2023 13:00:59`.

## Estrutura

| Arquivo | Função |
|---|---|
| `index.js` | Servidor Express com as rotas da API |
| `baixarplanilha.js` | Baixa a planilha usando o link definido no `.env` |
| `lerCSV.js` | Lê o `dados.csv` |
| `calculo.js` | Calcula as horas e as ocorrências de cada funcionário no mês |
| `database.js` | Banco SQLite local (`sis-ponto.db`), criado automaticamente |
| `public/` | Interface web (dashboard) |

## Arquivos que não vão para o repositório

Por segurança, e porque contêm dados pessoais de funcionários (LGPD), estes arquivos ficam só no computador local (veja o `.gitignore`):

- `.env`: link da planilha
- `dados.csv`: registros de ponto
- `sis-ponto.db`: banco de dados
- `*.docx`: modelos de recibo
- `node_modules/`
