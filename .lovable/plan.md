

## Problema Raiz

As abas "somem" porque componentes como `RepKPIs` e `ExecutiveDashboard` têm **cálculos complexos (useMemo) entre o carregamento de dados e o `return`**. Se qualquer cálculo lança exceção (dados `undefined`, divisão por zero, `.filter()` em `null`), o componente inteiro crasha ANTES de chegar ao `SafeComponent`. O `KpiErrorBoundary` captura, mas mostra um card genérico que substitui todo o conteúdo da aba.

A sidebar em si sempre renderiza (vem do `PriceCalculator`), mas o **conteúdo** da aba ativa desaparece — e o usuário percebe como "a aba sumiu".

## Solução Definitiva

### 1. Proteger TODOS os useMemo no RepKPIs com try-catch
**Arquivo**: `src/components/RepKPIs.tsx`

Envolver cada bloco `useMemo` complexo (linhas ~310-477: `activeMonths`, `openByRep`, `repMetrics`, `chartData`, `globalKpis`, `funnelData`, `weeklyChartData`, `lossAnalysis`) em try-catch, retornando valores default seguros em caso de erro:

```tsx
const repMetrics = useMemo(() => {
  try {
    // lógica existente...
  } catch (err) {
    console.error("repMetrics error:", err);
    return [];
  }
}, [deps]);
```

Também proteger `metaPct` (linha 479) com fallback: `const metaPct = (globalKpis?.totalMeta ?? 0) > 0 ? ... : 0;`

### 2. Proteger computações no ExecutiveDashboard
**Arquivo**: `src/components/ExecutiveDashboard.tsx`

Envolver os blocos de cálculo de KPIs (repRanking, resumoExecutivo, etc.) em try-catch com valores default.

### 3. Melhorar KpiErrorBoundary para manter layout
**Arquivo**: `src/components/KpiErrorBoundary.tsx`

Garantir que o fallback do ErrorBoundary tenha `min-height` e layout compatível com o container da aba, para que não "desapareça" visualmente.

### 4. Adicionar console.log de diagnóstico
Adicionar logs nos catch de cada useMemo para facilitar debug futuro, sem impactar performance.

## Arquivos Modificados
- `src/components/RepKPIs.tsx` — try-catch em ~8 useMemo + proteção de `metaPct`
- `src/components/ExecutiveDashboard.tsx` — try-catch em computações de KPI
- `src/components/KpiErrorBoundary.tsx` — fallback com min-height adequado

