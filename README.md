# Etiquetas Total

Pagina web estatica hospedada no GitHub Pages para tratamento automatizado de arquivos CSV de remessas.

## O que o sistema faz

Recebe um arquivo .csv e aplica as seguintes transformacoes em sequencia:

1. Remove todas as aspas simples de todas as celulas
2. Substitui todas as linhas da coluna **CNPJ** pelo valor fixo `34446018000133`
3. Substitui valores `null` na coluna **DestTelefone1** por `111111111`
4. Preenche celulas vazias ou `null` nas colunas **DestEnd**, **DestEndNum** e **DestCompl** com `1`
5. Trunca o conteudo da coluna **DestCompl** para no maximo 99 caracteres
6. Substitui variantes de Nao informado na coluna **DestEMAIL** por `naoinformado`
7. Ordena todas as linhas em ordem alfabetica pela coluna **DESTNOME**

O arquivo de saida e nomeado automaticamente como `CSV_TOTAL_DD_MM_YYYY.csv`, usando a data extraida da coluna **NFeData**.

## Estrutura do projeto

- `index.html` - pagina principal
- `styles.css` - interface visual
- `app.js` - toda a logica de processamento em JavaScript puro

## Como usar

1. Acesse a pagina pelo GitHub Pages
2. Selecione o arquivo `.csv`
3. Clique em **Processar**
4. Clique em **Baixar** para obter o arquivo tratado

## Execucao local

Sem dependencias ou build. Basta abrir `index.html` diretamente no navegador.
