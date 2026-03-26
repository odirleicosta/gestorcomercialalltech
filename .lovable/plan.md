

# Plano: Módulo "Radar de Fechamento"

Adicionar um novo módulo estratégico ao app existente sem alterar nenhuma funcionalidade atual.

---

## 1. Nova tabela `closing_deals`

Criar via migration uma tabela separada com todos os campos solicitados, enums para `sale_type`, `stage`, `probability` e `status`, RLS por `user_id`, e `updated_at` trigger.

Campos: `id`, `user_id`, `client_name`, `city`, `representative_id`, `empresa_id`, `machine_name`, `machine_type`, `quantity`, `deal_value`, `sale_type` (enum: Rentall, Venda Direta), `stage` (enum: Proposta Enviada, Negociação Ativa, Decisão Próxima), `probability` (enum: Baixa, Média, Alta), `start_date`, `expected_close_date`, `competitor`, `trade_in` (boolean), `main_objection`, `risk_reason`, `next_step`, `notes`, `status` (enum: ativa, ganha, perdida), `created_at`, `updated_at`.

---

## 2. Novo componente `ClosingRadar.tsx`

Componente principal com:

- **Lista de negociações** em cards com destaque visual por probabilidade (verde/amarelo/vermelho)
- **Filtros** por vendedor, estágio, probabilidade, tipo de venda, status, concorrente, com/sem usado
- **Formulário** de cadastro/edição em Dialog/Drawer, reutilizando representantes e empresas existentes via autocomplete
- **Ações**: cadastrar, editar, marcar ganha/perdida, excluir
- Cada card mostra: cliente, cidade, vendedor, máquina, tipo, quantidade, valor, tipo venda, estágio, probabilidade, data prevista, dias em aberto, concorrente, indicador de usado

---

## 3. Integração na navegação

- **Sidebar** (`PriceCalculator.tsx`): adicionar entrada "Radar" com ícone `Crosshair` entre "Vendas" e "Comissões"
- **BottomNavBar** (`BottomNavBar.tsx`): adicionar "Radar" no array `MORE_TABS`
- **Tabs**: adicionar `TabsTrigger` e `TabsContent` para `value="closing-radar"` renderizando `<ClosingRadar userId={user.id} />`

---

## 4. Blocos no Dashboard

Adicionar ao final do `ExecutiveDashboard.tsx` (sem alterar blocos existentes):

- **Pipeline em Fechamento**: total negociações ativas, valor total, total máquinas, ticket médio
- **Previsão de Fechamento**: separação por alta/média/baixa probabilidade com quantidade e valor
- **Alertas do Gestor**: negociações >30 dias, sem próximo passo, baixa probabilidade, próximas da data, risco alto
- **Top 5 Prioridades**: 5 negociações mais importantes (maior valor + maior probabilidade + data mais próxima)

Dados obtidos via query direta à tabela `closing_deals` filtrada por `user_id`.

---

## Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/migrations/` | Nova migration (tabela + enums + RLS + trigger) |
| `src/components/ClosingRadar.tsx` | **Novo** - componente principal |
| `src/components/PriceCalculator.tsx` | Adicionar aba na sidebar, tabs e import |
| `src/components/BottomNavBar.tsx` | Adicionar "Radar" no MORE_TABS |
| `src/components/ExecutiveDashboard.tsx` | Adicionar 4 blocos estratégicos no final |

Nenhum arquivo existente será removido ou terá lógica alterada.

