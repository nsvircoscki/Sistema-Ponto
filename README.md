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

> Na planilha, a coluna `Name` é o **e-mail** do funcionário (é a chave do cadastro local) e `Total Wages` é o **código de ocorrência**, não dinheiro:
> 1 = esquecimento, 2 = atestado, 3 = férias, 4 = sem intervalo, 5 = outros, 6 = falta.
> `Hourly Wage` e `Total Hours` não são usados: o valor da hora vem sempre do cadastro local.

## Importar o CSV exportado do SisCCF

Se você exporta o relatório de pontos do SisCCF e quer subir o arquivo na mão, configure no `.env`:

```
FONTE_PONTOS=arquivo
```

Depois reinicie o sistema. Na aba **Folha**:

1. Escolha o mês e o ano.
2. Clique em **Importar CSV do SisCCF** e selecione o arquivo exportado. A folha é gerada logo em seguida.

Como funciona:

- O arquivo fica guardado no banco local (tabela `pontos_importados`), **um por mês**. Importar de novo o mesmo mês substitui o anterior, e cada importação fica na auditoria.
- O sistema recusa um arquivo sem nenhum ponto do mês escolhido, para evitar importar no mês errado.
- O CSV pode ser separado por vírgula ou ponto e vírgula, em UTF-8 ou no padrão do Excel (Windows-1252). As colunas são as mesmas do export do CCF descritas abaixo, incluindo `CCF ID` e `Observacao`.
- Para o 13º, o sistema junta os meses importados do ano.
- Vínculo de funcionários, conferência e fechamento funcionam como na seção abaixo. Só a lista de aparelhos com pontos pendentes não aparece, porque ela não vem no arquivo.

## Pontos vindos do CCF (em validação)

O CCF pode substituir a planilha como fonte dos pontos. **O CCF não conhece salário**: ele só manda as batidas. Salário, descontos, férias, 13º e o histórico continuam só neste computador.

O fluxo do Google Sheets continua sendo o padrão. Para testar o CCF, configure no `.env`:

```
FONTE_PONTOS=ccf
CCF_PONTO_URL=https://ccf.seudominio.com.br/api/sis-ponto
CCF_EXPORT_TOKEN=<token configurado no CCF>
```

Para voltar à planilha, use `FONTE_PONTOS=sheets` ou apague a linha.

**O que muda com `FONTE_PONTOS=ccf`:**

- **Fonte dos pontos:** o sistema busca `export.csv?mes=YYYY-MM` no CCF (para o 13º, `?ano=YYYY`).
  - O CSV tem as mesmas colunas da planilha, mais `CCF ID` e `Observacao`.
  - `Hourly Wage` vem vazio e `Total Wages` vem como `0`.
- **Vínculo de funcionários:** é feito pelo **ID do CCF**, não pelo nome, e fica na tabela `vinculo_ccf`.
  - Na primeira vez, a seção **Conferência** (abaixo de "Gerar Folha") lista os funcionários do CCF ainda não vinculados.
  - Ela sugere o cadastro local de mesmo e-mail; um clique em "Vincular" confirma.
  - **Pontos de quem não está vinculado ficam fora da folha** e aparecem como pendência. Eles não são ignorados em silêncio.
- **Conferência antes de fechar:** ao clicar em "Salvar", se houver pendência, o sistema pede confirmação. Contam como pendência:
  - entrada sem saída, saída sem entrada ou sequência inconsistente;
  - funcionário não vinculado;
  - funcionário com salário zerado;
  - aparelho com ponto ainda não enviado ao CCF.
- **Fechamento:** ao salvar a folha, uma cópia dos pontos usados é gravada na tabela `folha_fechamento`.
  - Gerar de novo um mês fechado usa essa cópia.
  - Se os pontos mudaram depois no CCF (ou na planilha), a conferência avisa e oferece "Usar dados atuais". Para valer, a folha precisa ser salva de novo.
- **Auditoria:** as alterações abaixo ficam na tabela `auditoria`, com quem, quando, valor antigo e valor novo. Para consultar: `GET /api/auditoria`.
  - salário, tipo, abono e vales do funcionário;
  - descontos;
  - vínculos;
  - folhas salvas, substituídas ou apagadas;
  - fechamentos.

  "Quem" é o `OPERADOR_FOLHA` do `.env` ou, sem ele, o usuário do Windows.

## Testes

```
npm test
```

Os testes cobrem:
- leitura do CSV do CCF e da planilha;
- conciliação por ID;
- pendências (sem saída, sem entrada, inconsistente);
- cálculo do salário com o valor da hora local, ignorando `Hourly Wage`;
- auditoria e fechamento;
- busca no CCF com token.

Eles usam um banco temporário e nunca tocam no `sis-ponto.db`.

## Segurança do PC da folha

Este computador guarda salários e dados pessoais (LGPD).

- **Disco criptografado** com BitLocker (Windows Pro). A chave de recuperação fica guardada fora da máquina.
- **Conta do Windows com senha forte**, bloqueio automático de tela e **acesso físico restrito** à máquina.
- **Backup criptografado e periódico**, guardado fora da máquina (outro disco ou nuvem, com criptografia), de:
  - `sis-ponto.db`;
  - `.env`;
  - modelos `.docx`;
  - recibos gerados.
- **Teste de restauração** periódico: restaurar o backup em outra pasta, abrir o sistema e conferir uma folha antiga.
- **Responsável substituto definido:** quem opera a folha na ausência do responsável, com acesso documentado ao backup e à senha. O `OPERADOR_FOLHA` dessa pessoa deve ser diferente, para a auditoria distinguir quem fez cada alteração.
- O `CCF_EXPORT_TOKEN` dá leitura de todos os pontos. Se vazar, troque no CCF (`PONTO_EXPORT_TOKENS`) e aqui.
- O servidor deste sistema só precisa responder em `localhost`. O CCF **não** acessa este computador.

## Estrutura

| Arquivo | Função |
|---|---|
| `index.js` | Servidor Express com as rotas da API |
| `fontesPontos/` | De onde vêm os pontos: planilha do Google ou CCF (`FONTE_PONTOS`) |
| `baixarplanilha.js` | Baixa os pontos da fonte configurada e grava `dados.csv` |
| `lerCSV.js` | Lê o CSV de pontos |
| `calculo.js` | Calcula as horas e as ocorrências de cada funcionário no mês, e lista as pendências |
| `conciliacao.js` | Liga o funcionário do CCF (ID) ao cadastro local (e-mail) |
| `auditoria.js` | Decide o que vai para o log de auditoria |
| `database.js` | Banco SQLite local (`sis-ponto.db`), criado automaticamente |
| `public/` | Interface web (dashboard); `conferencia.js` e `calculoFolha.js` |

## Arquivos que não vão para o repositório

Por segurança, e porque contêm dados pessoais de funcionários (LGPD), estes arquivos ficam só no computador local (veja o `.gitignore`):

- `.env`: link da planilha
- `dados.csv`: registros de ponto
- `sis-ponto.db`: banco de dados
- `*.docx`: modelos de recibo
- `node_modules/`
