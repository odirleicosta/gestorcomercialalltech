

# Conectar aba Visitas ao FilterBar (periodMode)

## Problema
A aba **Visitas** sempre carrega dados de uma única semana (`filterWeek`), ignorando o modo de período selecionado no FilterBar. Quando o usuário seleciona T2, Mês ou Ano, os KPIs e a tabela de visitas não mudam — ficam presos na última semana selecionada.

A aba **Desempenho** já funciona corretamente porque usa `allYearVisits` e agrega por `relevantWeeks`.

## Solução em `src/components/RepKPIs.tsx`

1. **Refatorar `filteredVisits` e `kpis`** para agregar dados de `allYearVisits` conforme o `periodMode`:
   - **month**: somar todas as semanas do mês selecionado
   - **quarter**: somar todas as semanas do trimestre
   - **year**: somar todas as semanas do ano
   - Quando `showWeek` estiver ativo (e periodMode = month), manter o comportamento atual de semana única

2. **Atualizar `chartData`** para usar os mesmos dados agregados

3. **Manter editabilidade**: a edição inline de visitas continua operando por semana (usando `filterWeek`), mas os KPIs e tabela de leitura mostram o agregado do período

4. **Tabela de visitas**: quando em modo trimestre/ano, a tabela mostra totais agregados (somente leitura); quando em modo mês/semana, mantém os inputs editáveis por semana

