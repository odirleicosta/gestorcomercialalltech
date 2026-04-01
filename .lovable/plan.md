

## Diagnóstico

A sidebar tem `overflow-y-auto` na área de navegação, mas em viewports menores ou com zoom, a 9ª aba fica abaixo da área visível. Como navegadores modernos escondem a scrollbar por padrão, o usuário não percebe que pode rolar — parece que abas estão "faltando".

## Plano: Garantir que todas as abas fiquem sempre visíveis

### Mudança única em `src/components/PriceCalculator.tsx`

1. **Reduzir padding/gap dos botões da sidebar** — diminuir `py-2.5` para `py-2` e `gap-1` para `gap-0.5` nos itens de navegação, para que 9 abas caibam sem scroll na maioria dos viewports.

2. **Adicionar classe de scrollbar visível** — aplicar `scrollbar-thin` ou estilo inline para que, caso ainda haja overflow, a barra de rolagem fique visível e o usuário saiba que pode rolar.

3. **Reduzir o espaçamento do header** — diminuir `mb-4` entre o header e a nav para `mb-2`.

### Resultado
Todas as 9 abas ficam visíveis sem precisar rolar em viewports ≥ 670px de altura. Em telas menores, a scrollbar fica visível para indicar que há mais itens.

