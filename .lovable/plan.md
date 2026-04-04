

# Remover filtros duplicados das sub-abas Visitas, Oportunidades e Metas

## Problema
As sub-abas Visitas, Oportunidades e Metas ainda têm seus próprios selects de Equipe/Ano/Mês internos, duplicando o FilterBar unificado que já existe no topo.

## Alterações em `src/components/RepKPIs.tsx`

1. **Sub-aba Visitas (linhas ~590-621)**: Remover os `<Select>` de Equipe, Ano e Semana. Manter apenas os botões "Importar Planilha" e "Excluir Todas". O filtro de semana já está no FilterBar via `showWeek`.

2. **Sub-aba Oportunidades (linhas ~898-917)**: Remover completamente o bloco `<div>` com os 3 `<Select>` (Equipe, Ano, Mês).

3. **Sub-aba Metas (linhas ~997-1016)**: Remover completamente o bloco `<div>` com os 3 `<Select>` (Equipe, Ano, Mês).

Nenhuma lógica de filtragem precisa mudar pois os estados `filterRep`, `filterYear`, `filterMonth` já são controlados pelo FilterBar no topo e compartilhados por todas as sub-abas.

