

## Plano: Correção definitiva da importação de visitas

### Causa raiz identificada

O problema é duplo:

1. **Banco**: A constraint foi criada como `CREATE UNIQUE INDEX` em vez de `ALTER TABLE ADD CONSTRAINT ... UNIQUE`. O PostgREST exige uma **CONSTRAINT** real para aceitar `on_conflict` — um índice único sozinho não funciona.

2. **Código**: O `VisitImport.tsx` atual usa `.insert()` puro, mas o browser está rodando um bundle antigo que ainda usa `.upsert()` com `on_conflict=user_id,hash_linha`. Para resolver de vez, vou trocar para `.upsert()` com o `onConflict` correto, alinhado à constraint nova.

### Mudanças

**1. Migration — Criar CONSTRAINT real (não apenas INDEX)**

```sql
-- Remover index que não serve como constraint para PostgREST
DROP INDEX IF EXISTS public.visitas_importadas_user_rep_hash_key;
DROP INDEX IF EXISTS public.visitas_importadas_hash_unique;

-- Remover constraints antigas caso existam
ALTER TABLE public.visitas_importadas 
  DROP CONSTRAINT IF EXISTS visitas_importadas_user_rep_hash_key;
ALTER TABLE public.visitas_importadas 
  DROP CONSTRAINT IF EXISTS visitas_importadas_hash_unique;
ALTER TABLE public.visitas_importadas 
  DROP CONSTRAINT IF EXISTS visitas_importadas_user_id_hash_linha_key;

-- Criar a CONSTRAINT UNIQUE real (PostgREST exige constraint, não index)
ALTER TABLE public.visitas_importadas 
  ADD CONSTRAINT visitas_importadas_user_rep_hash_key 
  UNIQUE (user_id, representative_id, hash_linha);
```

**2. `src/components/VisitImport.tsx` — Usar upsert com onConflict correto**

Trocar o fluxo de `insert()` para `upsert()` com `onConflict: "user_id,representative_id,hash_linha"` e `ignoreDuplicates: true`. Remove a lógica manual de buscar hashes existentes, simplificando o código:

- Deduplicar dentro do arquivo (manter)
- Usar `.upsert(batch, { onConflict: "user_id,representative_id,hash_linha", ignoreDuplicates: true })` em lotes de 50
- Contar inseridos vs ignorados
- Recalcular `weekly_visits` a partir de `visitas_importadas` (manter)

**3. Badge de versão** — Atualizar para `v4-upsert` para confirmar visualmente que o bundle novo está ativo.

### Resultado esperado
- O erro `there is no unique or exclusion constraint matching the ON CONFLICT specification` desaparece
- Visitas importam corretamente sem duplicar
- Representantes diferentes podem ter visitas com mesmo hash
- O badge `v4-upsert` confirma que o código novo está rodando

