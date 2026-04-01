

## Problema Identificado

A aba KPIs (e o Dashboard) **desaparece** porque os componentes `RepKPIs` e `ExecutiveDashboard` fazem um **early return** quando há erro de carregamento. Na linha 479 do `RepKPIs.tsx`:

```tsx
if (loading || loadError) return (
  <SafeComponent loading={loading} error={loadError} onRetry={...}>
    <></>
  </SafeComponent>
);
```

Isso funciona para loading/erro, mas o problema real é que **erros de runtime dentro do `useMemo` ou da renderização** (como acessar propriedades de dados `undefined`) causam um crash que o `KpiErrorBoundary` deveria capturar — mas o ErrorBoundary mostra um card genérico que pode não ser visível se o layout do tab não renderizar corretamente.

Além disso, o componente `RepKPIs` tem **1756 linhas** com muitos `useMemo` complexos que podem lançar exceções em dados inesperados (ex: `null` em campos, arrays vazios, divisão por zero).

## Plano de Correção

### 1. Remover early returns nos componentes internos das abas
**Arquivos**: `RepKPIs.tsx`, `ExecutiveDashboard.tsx`

Em vez de retornar completamente quando loading/erro, mover a lógica de `SafeComponent` para **dentro** do return principal, envolvendo apenas o conteúdo — garantindo que o componente sempre monta sem crash.

```tsx
// ANTES (causa desaparecimento):
if (loading || loadError) return <SafeComponent ...><></></SafeComponent>;
// lógica complexa com useMemo que pode crashar...
return <div>...</div>;

// DEPOIS (seguro):
return (
  <SafeComponent loading={loading} error={loadError} onRetry={...}>
    {/* conteúdo normal aqui */}
  </SafeComponent>
);
```

### 2. Proteger os `useMemo` contra dados vazios/undefined
**Arquivo**: `RepKPIs.tsx`

Adicionar guards nos useMemo mais complexos para evitar crashes quando `reps`, `deals`, `closingDeals` estão vazios ou com campos nulos. Usar valores default (`[]`, `0`, `""`) antes de operações como `.filter()`, `.map()`, `.reduce()`.

### 3. Garantir que `handleTabChange` valida o tab
**Arquivo**: `PriceCalculator.tsx`

Já existe validação com `isAppTab()` — está OK. Confirmar que `activeTab` nunca fica undefined.

### 4. Adicionar try-catch nos useMemo críticos do RepKPIs
**Arquivo**: `RepKPIs.tsx`

Envolver os blocos `useMemo` mais complexos (repMetrics, chartData, lossAnalysis) em try-catch, retornando arrays/objetos vazios em caso de erro, em vez de crashar o componente inteiro.

## Resumo de Arquivos Modificados
- `src/components/RepKPIs.tsx` — remover early return, proteger useMemos
- `src/components/ExecutiveDashboard.tsx` — remover early return, usar SafeComponent como wrapper

