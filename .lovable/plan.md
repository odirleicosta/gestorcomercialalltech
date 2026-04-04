

# Remover aba Importação e mover imports para as sub-abas KPIs

## O que muda
A aba "Importação" (BiImport) será removida da navegação. As funcionalidades de importação de **Oportunidades** e **Metas** (que só existem no BiImport) serão adicionadas como botões "Importar Planilha" diretamente nas sub-abas correspondentes do KPIs — igual ao que já existe para Visitas e Perdidas.

## Arquivos alterados

### 1. `src/lib/app-tabs.ts`
- Remover `"importacao"` do tipo `AppTabId`
- Remover a entrada `{ value: "importacao", icon: Upload, label: "Importação" }` de `PRIMARY_APP_TABS`
- Ajustar `BOTTOM_NAV_TABS` e `SECONDARY_APP_TABS` se necessário

### 2. `src/components/PriceCalculator.tsx`
- Remover import do `BiImport`
- Remover o `<TabsContent value="importacao">` e seu conteúdo

### 3. `src/components/RepKPIs.tsx`
- **Sub-aba Oportunidades**: adicionar botão "Importar Planilha" que abre um modal de upload. Reutilizar a lógica de `BiImport.importOportunidades` (agrupa por rep+ano+mês, upsert em `monthly_opportunities`)
- **Sub-aba Metas**: adicionar botão "Importar Planilha" com modal. Reutilizar a lógica de `BiImport.importMetas` (upsert em `monthly_goals`)
- Adicionar estados `oppImportOpen` e `metaImportOpen` para controlar os modais

### 4. Novo: `src/components/OpportunityImport.tsx`
Componente modal similar ao `VisitImport`, com:
- Upload de .xlsx, preview de linhas
- Auto-match de "Proprietario Nome" com reps cadastrados
- Agrupamento por rep+ano+mês e upsert em `monthly_opportunities`
- Colunas esperadas: Proprietario Nome, Data Criação

### 5. Novo: `src/components/GoalImport.tsx`
Componente modal similar, com:
- Upload de .xlsx, preview
- Colunas esperadas: Representante, Tipo Produto, Meta, Nome Mês
- Selector de ano para as metas
- Upsert em `monthly_goals`

## Resultado
Cada sub-aba do KPIs terá seu próprio botão de importação contextual, eliminando a aba separada.

