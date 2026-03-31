

## Plano: Remover aba "Importar BI" e adicionar entrada manual de dados na aba KPIs

### Contexto
A aba "Importar BI" permite importar dados de 4 categorias via Excel: Visitas, Oportunidades, Perdas e Metas. A aba KPIs já possui entrada manual para **Visitas** (tab "visitas" com editor inline) e **Negociações/Perdas** (dialogs de criação). Faltam apenas formulários manuais para **Oportunidades** e **Metas**.

### Mudanças

**1. Remover a aba "Importar BI" da navegação**
- `src/lib/app-tabs.ts`: Remover `"bi-import"` do tipo `AppTabId` e do array `SECONDARY_APP_TABS`, remover import do ícone `Upload`
- `src/components/PriceCalculator.tsx`: Remover o import do `BiImport`, remover o `<TabsContent value="bi-import">` correspondente

**2. Adicionar nova view "Dados" na aba KPIs**
- `src/components/RepKPIs.tsx`:
  - Adicionar `"dados"` ao tipo `ViewTab`
  - Adicionar botão "Dados" na barra de views (junto a Equipe, Representante, Perdas, Visitas)
  - Criar seção com dois cards:

**Card 1 — Oportunidades Mensais**
- Tabela editável: linhas = representantes, colunas = meses (Jan-Dez)
- Células com input numérico (quantidade de oportunidades)
- Carrega dados existentes de `monthly_opportunities`
- Botão "Salvar Oportunidades" faz upsert em `monthly_opportunities` com `onConflict: "user_id,representative_id,ano,mes"`
- Seletor de ano no topo

**Card 2 — Metas Mensais**
- Tabela editável: linhas = representantes, colunas = meses (Jan-Dez)
- Células com input numérico (meta de quantidade)
- Select de `machine_type` (filtro) para editar metas por tipo
- Carrega dados existentes de `monthly_goals`
- Botão "Salvar Metas" faz upsert em `monthly_goals` com `onConflict: "representative_id,mes,ano,machine_type"`

### Arquivos modificados
1. `src/lib/app-tabs.ts` — remover bi-import
2. `src/components/PriceCalculator.tsx` — remover BiImport import e TabsContent
3. `src/components/RepKPIs.tsx` — adicionar view "Dados" com formulários de oportunidades e metas

### Design
- Seguir o padrão dark existente com `Card`, `Table`, `Input`, `Button`, `Select`
- Mesmo estilo da tab "Visitas" que já funciona com editor inline

