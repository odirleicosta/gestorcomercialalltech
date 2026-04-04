
# Fix: importação de visitas continua sem aparecer no app

## Diagnóstico
O problema agora não está mais no cálculo do `weekly_visits`. O ponto principal é outro:

- O representante **Lauro Roberto Zimermann existe**
- Mas no banco **não há linhas dele** em `visitas_importadas` nem em `weekly_visits`
- Ao mesmo tempo, existem muitas visitas importadas para outros representantes
- Na implementação atual, a deduplicação usa:
  - `hash_linha = data + cliente + assunto`
  - índice único no banco: `(user_id, hash_linha)`
  - `upsert(... onConflict: "user_id,hash_linha")`

Isso faz a duplicidade valer para o usuário inteiro, não por representante. Resultado:
- se uma visita com mesmo `data + cliente + assunto` já foi importada para outro vendedor,
- a importação do Lauro é bloqueada como “duplicada”
- e nada entra para o Lauro no app

Por isso o recálculo anterior não resolve este caso: ele só recalcula `weekly_visits` a partir do que já existe em `visitas_importadas`, mas para o Lauro hoje **não existe nada salvo**.

## O que vou implementar

### 1. Corrigir a deduplicação para ser por representante
Criar uma migration para trocar a unicidade de:
```text
(user_id, hash_linha)
```
para:
```text
(user_id, representative_id, hash_linha)
```

Assim:
- repetir a mesma planilha para o mesmo representante continua sendo ignorado
- importar visitas semelhantes para representantes diferentes passa a funcionar

### 2. Ajustar o import no frontend
Em `src/components/VisitImport.tsx`:
- atualizar o `upsert` para usar:
```text
onConflict: "user_id,representative_id,hash_linha"
```
- manter o restante da lógica de recálculo semanal

### 3. Preservar o comportamento correto já feito
Manter:
- recálculo de `weekly_visits` quando tudo vier como duplicado
- limpeza conjunta de `visitas_importadas` + `weekly_visits`

Essas partes continuam úteis depois da correção.

### 4. Reprocessar o caso do Lauro
Depois da correção:
- reimportar a planilha do Lauro
- isso finalmente deve inserir os registros em `visitas_importadas`
- e então alimentar `weekly_visits` e os KPIs

Observação importante:
- a migration não recupera automaticamente visitas que nunca foram gravadas
- para o Lauro, será necessário **importar novamente** após o ajuste

## Arquivos envolvidos
- `supabase/migrations/...sql`  
  troca do índice/constraint de duplicidade
- `src/components/VisitImport.tsx`  
  ajuste do `onConflict`

## Detalhes técnicos
Causa raiz identificada no código atual:
```text
hashRow() não inclui representative_id
índice único do banco também não inclui representative_id
```

Então duas visitas iguais para reps diferentes entram em conflito indevido.

A correção mais segura é:
- não mudar a ideia do hash
- mudar o escopo da unicidade no banco e no `upsert`

Isso reduz impacto e corrige o bug sem mexer na estrutura analítica existente.

## Validação após implementar
1. Importar novamente a planilha do Lauro
2. Confirmar que o detalhamento de visitas importadas mostra registros com `representative_id` do Lauro
3. Confirmar que a linha do Lauro na aba Visitas sai de `0`
4. Reimportar a mesma planilha do Lauro e verificar que não duplica
5. Confirmar que importar uma visita parecida para outro representante continua funcionando
