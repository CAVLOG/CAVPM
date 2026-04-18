
# SISTEMA DE CONTROLE PATRIMONIAL DTIC-PRÓ

Este projeto é um sistema de controle de estoque (Almoxarifado) desenvolvido com React, TypeScript, Vite e Supabase.

## Pré-requisitos

1. **Node.js**: Você precisa ter o Node.js instalado (versão 18 ou superior).
   - Baixe em: https://nodejs.org/

2. **Banco de Dados (Supabase)**:
   - O projeto já possui chaves configuradas em `services/supabaseClient.ts`.
   - Certifique-se de que as tabelas foram criadas no Supabase. Use o arquivo `database_schema.sql` para criar a estrutura necessária.

## Como Rodar Localmente

1. **Instalar Dependências**
   Abra o terminal na pasta do projeto e execute:
   ```bash
   npm install
   ```

2. **Iniciar o Servidor de Desenvolvimento**
   Execute:
   ```bash
   npm run dev
   ```

3. **Acessar o Sistema**
   O terminal mostrará um link local, geralmente:
   - http://localhost:5173/

## Funcionalidades Principais

- **Login/Logout**: Controle de acesso (Admin, Gestor, Operador).
- **Entrada (NE)**: Cadastro de Notas de Empenho e entrada de produtos.
- **Distribuição (FIFO)**: Saída de materiais priorizando lotes mais antigos automaticamente.
- **Relatórios**: Histórico de movimentações e estorno.
- **Catálogo**: Padronização de nomes de produtos.

## Estrutura de Pastas

- `/src/pages`: Telas do sistema (Dashboard, Estoque, Distribuição, etc).
- `/src/services`: Lógica de negócio e conexão com Banco de Dados.
- `/src/components`: Componentes reutilizáveis (Layout, Menus).
- `/src/types`: Definições de tipos TypeScript (Interfaces).

## Deploy (Locaweb/FTP)

Para gerar os arquivos finais para colocar na Locaweb ou qualquer servidor Apache:

1. Execute:
   ```bash
   npm run build
   ```
2. O conteúdo da pasta `dist` que será criada deve ser enviado para o servidor.
