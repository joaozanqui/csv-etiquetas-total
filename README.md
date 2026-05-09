# Etiquetas Total

Projeto inicial para uma página web estática compatível com GitHub Pages.

## Objetivo atual

- permitir upload de arquivo Excel no navegador
- reimplementar o processamento por etapas
- gerar arquivo final para download apos validacao dos passos

## Ponto importante de arquitetura

GitHub Pages não executa backend Python. Isso significa que o tratamento do arquivo precisa seguir um destes caminhos:

1. Python rodando no navegador, por exemplo com Pyodide
2. Reescrever a lógica de transformação em JavaScript
3. Hospedar o processamento em outro serviço e usar a página apenas como interface

## Estrutura criada

- `index.html`: página principal
- `styles.css`: interface visual
- `app.js`: validação inicial do upload e estados da interface
- `.github/copilot-instructions.md`: checklist de inicialização do workspace

## Proximo passo esperado

Processamento reiniciado do zero. A implementacao sera refeita por partes a partir da proxima instrucao.

1. receber o arquivo Excel
2. aplicar cada regra de negocio individualmente
3. validar o resultado e gerar o arquivo final

## Execução local

Como esta versão inicial não depende de build, basta abrir `index.html` no navegador para visualizar a interface.