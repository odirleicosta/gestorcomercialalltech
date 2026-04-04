

# Filtro unificado: barra fixa no topo para todo o app

## Problema atual
O app tem 4 padrões de filtro diferentes:
- **Dashboard**: Popover (badge clicável)
- **KPIs > Desempenho**: Painel expansível com pills
- **KPIs > Perdidas**: Painel expansível com pills (variante vermelha)
- **Comissões**: Select dropdowns + pills inline

Isso gera inconsistência visual e confusão.

## Solução
Criar um componente reutilizável `<FilterBar />` que renderiza uma barra horizontal sempre visível com selects compactos lado a lado.

## Componente novo: `src/components/FilterBar.tsx`

```text
┌──────────────────────────────────────────────────────────────┐
│  [2025 ▾]  [Mês ▾ / T1-T4 / Ano]  [Jan ▾]  [Todos Reps ▾] │
└──────────────────────────────────────────────────────────────┘
```

- **Ano**: Select compacto (2024-2027)
- **Visão**: Toggle group inline (Mês | T1 | T2 | T3 | T4 | Ano)
- **Mês**: Select compacto (aparece só quando Visão = Mês)
- **Representante**: Select compacto (Todos + lista)
- Props configuráveis: `showWeek?`, `showRep?`, `showPeriodMode?` para adaptar a cada contexto
- Responsivo: em mobile, usa `flex-wrap` para quebrar em 2 linhas

## Arquivos alterados

1. **`src/components/FilterBar.tsx`** (novo)
   - Componente puro com props: `year`, `onYearChange`, `periodMode`, `onPeriodModeChange`, `month`, `onMonthChange`, `quarter`, `onQuarterChange`, `rep`, `onRepChange`, `reps[]`, `showWeek?`, `week?`, `onWeekChange?`
   - Usa `Select` compactos do shadcn + toggle group para período
   - Estilo: `bg-card border rounded-xl p-2 flex items-center gap-2 flex-wrap`

2. **`src/components/ExecutiveDashboard.tsx`**
   - Remover o Popover de filtro (linhas 330-386)
   - Substituir por `<FilterBar ... />`

3. **`src/components/RepKPIs.tsx`**
   - Remover `filterExpanded`, `lostFilterExpanded` e os painéis expansíveis duplicados
   - Colocar um `<FilterBar />` único acima das sub-tabs, compartilhado por todas as sub-abas
   - Na sub-aba Visitas: adicionar seletor de semana dentro do FilterBar via prop `showWeek`

4. **`src/components/CommissionsTab.tsx`**
   - Remover os Select dropdowns e PillButtons do header
   - Substituir por `<FilterBar ... />`

## Resultado
Um único padrão visual para filtros em todo o app: barra compacta, sempre visível, sem cliques extras para expandir/abrir.

