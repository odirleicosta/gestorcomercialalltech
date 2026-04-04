

# Fix: Visitas do Lauro não aparecem (dessincronização weekly_visits)

## Problema identificado

O toast mostra **"0 visitas importadas, 163 duplicadas ignoradas"**. Isso significa:
1. As 163 visitas do Lauro **existem** na tabela `visitas_importadas`
2. Porém a tabela `weekly_visits` mostra **0** para o Lauro
3. O `VisitImport` só agrega em `weekly_visits` os registros **novos** (recém-inseridos). Como todos foram ignorados por duplicidade, nenhuma agregação ocorreu
4. Em algum momento, `weekly_visits` foi limpa sem limpar `visitas_importadas`, causando a dessincronização

## Correções

### 1. `VisitImport.tsx` — Recalcular weekly_visits mesmo com duplicatas
Quando `inserted === 0` (todas duplicadas), recalcular `weekly_visits` a partir de **todos** os registros existentes em `visitas_importadas` para aquele representante. Isso garante que a re-importação sincronize os dados.

Lógica:
- Após o upsert, se `inserted === 0`, buscar todos os registros de `visitas_importadas` para o `user_id` + `representative_id`
- Agrupar por semana/ano e recriar os registros em `weekly_visits` (delete + insert, ou upsert)
- Toast: "163 registros já existentes, weekly_visits recalculado"

### 2. `RepKPIs.tsx` — "Excluir Todas" limpar ambas as tabelas
O botão "Excluir Todas" de visitas atualmente só deleta de `visitas_importadas`. Deve também deletar de `weekly_visits` para o mesmo `user_id`, evitando dessincronização futura.

## Resumo técnico

```text
VisitImport.handleImport():
  1. Upsert em visitas_importadas (como hoje)
  2. SE inserted > 0: agregar novos em weekly_visits (como hoje)
  3. SE inserted === 0 E skipped > 0:
     → Buscar TODOS de visitas_importadas para rep
     → Agrupar por ano+semana
     → Deletar weekly_visits existentes para rep
     → Inserir novos totais em weekly_visits
     → Toast explicativo

RepKPIs "Excluir Todas":
  → Deletar de visitas_importadas + weekly_visits
```

