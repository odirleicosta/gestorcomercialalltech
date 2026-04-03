

## Plano: Integrar importação de planilha de visitas com análise no KPIs

### Problema atual
O botão "Importar Planilha" na sub-aba Visitas salva os dados na tabela `visitas_importadas`, mas a aba KPIs lê apenas da tabela `weekly_visits`. Os dados importados nunca são usados para análise. O callback `onImported` está vazio (`{ /* refresh data */ }`).

### Solução
Após importar a planilha, agregar automaticamente as visitas importadas por representante/semana e popular a tabela `weekly_visits`. Além disso, exibir uma seção de detalhamento das visitas importadas abaixo da tabela resumo semanal.

### Etapas

**1. Atualizar `VisitImport.tsx` — pós-importação, agregar em `weekly_visits`**
- Após inserir em `visitas_importadas`, agrupar os registros por `(representative_id, ano, semana)` usando a data da visita
- Para cada grupo, fazer upsert em `weekly_visits` somando a quantidade de visitas ao valor existente
- Isso faz os KPI cards e gráficos refletirem os dados importados imediatamente

**2. Atualizar `RepKPIs.tsx` — callback `onImported` funcional**
- No `onImported`, recarregar os dados de `weekly_visits` e `visitas_importadas` para atualizar a tela
- Adicionar um novo `useEffect` para carregar registros de `visitas_importadas` filtrados por ano/representante
- Exibir uma tabela expandível abaixo dos gráficos mostrando o detalhe das visitas importadas (data, cliente, CNPJ, assunto, descrição)

**3. Seção "Detalhamento de Visitas" na sub-aba Visitas**
- Nova seção com tabela paginada (ScrollArea) mostrando todas as visitas importadas do período
- Filtros de representante e ano já existentes serão reutilizados
- Badge com total de visitas importadas no período

### Arquivos modificados
- `src/components/VisitImport.tsx` — agregar visitas em `weekly_visits` após importação
- `src/components/RepKPIs.tsx` — carregar/exibir visitas importadas, callback `onImported` funcional

### Detalhes técnicos
- A agregação por semana usa a função `getWeekNumber()` já existente no código
- O upsert em `weekly_visits` usará `onConflict: "user_id,representative_id,ano,semana"` com soma incremental
- A tabela `visitas_importadas` já tem RLS configurado corretamente
- Nenhuma alteração destrutiva no banco de dados

