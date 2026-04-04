

# Conectar sub-abas Oportunidades e Metas ao periodMode do FilterBar

## Problema
As sub-abas **Oportunidades** e **Metas** carregam dados apenas do mês selecionado (`filterMonth`), ignorando o modo de período (Trimestre/Ano). Já existem dados anuais carregados (`allYearOpps`, `allYearGoals`, `allYearClosedDeals`) usados pelo Desempenho, mas Oportunidades e Metas não os utilizam.

## Solução em `src/components/RepKPIs.tsx`

### 1. Oportunidades — agregar por período
Refatorar `filteredOpportunities` e `oppKpis` para usar `allYearOpps` quando `periodMode` não é "mes":
- **Mês**: comportamento atual (dados de `opportunities` para o mês selecionado, editável)
- **Trimestre**: agregar `allYearOpps` para os meses do trimestre (somente leitura)
- **Ano**: agregar `allYearOpps` para todos os 12 meses (somente leitura)

Criar um `effectiveOpportunities` via `useMemo` que:
- Em modo "mes"/"semana": retorna `opportunities` (editável)
- Em modo "trimestre"/"ano": agrega `allYearOpps` por `representative_id`, somando `qty_proprias` e `qty_sdr` dos meses relevantes

Esconder botão "Salvar Oportunidades" quando não estiver em modo mês. Tornar inputs readonly em modo agregado.

### 2. Metas — agregar por período
Refatorar `filteredGoals` e `closedDealsForMetas` para usar `allYearGoals` e `allYearClosedDeals`:
- **Mês**: comportamento atual
- **Trimestre**: agregar metas e vendas fechadas dos meses do trimestre
- **Ano**: agregar metas e vendas fechadas de todos os meses

Criar `effectiveGoals` e `effectiveClosedDeals` via `useMemo` que agregam conforme `periodMode`.

### 3. Lógica de meses relevantes
Reutilizar a mesma lógica de `relevantMonths` que já existe no Desempenho:
```text
mes → [filterMonth]
trimestre → QUARTER_MONTHS[filterQuarter]
ano → [1..12]
```

Extrair para um `useMemo` no nível do componente (antes das sub-abas) para ser compartilhado.

### Resultado
Todas as 5 sub-abas (Visitas, Oportunidades, Metas, Desempenho, Perdidas) responderão ao FilterBar do topo de forma consistente.

