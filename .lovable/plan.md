
Objetivo: resolver definitivamente a importação de visitas sem permitir duplicidade e sem depender de `upsert + on_conflict`, que é exatamente o ponto que está quebrando agora.

Diagnóstico confirmado
- O código-fonte atual de `src/components/VisitImport.tsx` já está com `onConflict: "user_id,representative_id,hash_linha"`.
- Mas o tráfego real do app ainda mostra `on_conflict=user_id,hash_linha`.
- O erro exibido agora é:
```text
there is no unique or exclusion constraint matching the ON CONFLICT specification
```
- Isso indica o seguinte estado real:
  1. o banco já não aceita mais conflito por `(user_id, hash_linha)` como antes
  2. a interface em execução ainda está tentando usar o conflito antigo
  3. por isso a importação falha antes mesmo de gravar as visitas do Lauro

Plano de correção definitiva

1. Tirar o `onConflict` do fluxo de importação
Em vez de depender de:
```text
upsert(... onConflict: ...)
```
vou mudar o import para um fluxo determinístico:
- ler a planilha
- gerar `hash_linha` para cada linha válida
- remover duplicadas dentro da própria planilha
- consultar no banco quais hashes já existem para aquele `user_id + representative_id`
- inserir com `insert()` apenas as linhas realmente novas

Resultado:
- não haverá mais dependência de `on_conflict`
- some o erro 400 atual
- duplicidade continua bloqueada do jeito certo, por representante

2. Manter a proteção no banco como trava final
Mesmo tirando a dependência do `upsert`, o banco ainda precisa continuar protegido.
Vou consolidar a migration para garantir somente esta unicidade:
```text
(user_id, representative_id, hash_linha)
```
e remover explicitamente qualquer resquício antigo ligado a:
```text
(user_id, hash_linha)
```

A migration final precisa ser idempotente:
- `DROP INDEX IF EXISTS public.visitas_importadas_hash_unique`
- `DROP CONSTRAINT IF EXISTS visitas_importadas_user_id_hash_linha_key`
- recriar/garantir apenas a constraint correta:
```text
visitas_importadas_user_rep_hash_key UNIQUE (user_id, representative_id, hash_linha)
```

3. Recalcular `weekly_visits` sempre a partir da fonte real
Hoje o sistema ainda pode ficar dessincronizado entre:
- `visitas_importadas`
- `weekly_visits`

Para eliminar isso de vez, após cada importação eu vou:
- buscar todas as visitas já salvas daquele representante em `visitas_importadas`
- reagrupar por `ano + semana`
- apagar `weekly_visits` daquele representante
- recriar `weekly_visits` com os totais corretos

Assim:
- se entrou visita nova, os totais sobem corretamente
- se tudo já existia, os totais continuam corretos
- não depende mais de “somar apenas inseridas agora”

4. Bloquear duplicidade em dois níveis
Vou deixar a proteção completa em dois pontos:

Nível 1 — aplicação
- duplicada na mesma planilha: ignorada antes de inserir
- duplicada já existente para o mesmo representante: ignorada antes de inserir

Nível 2 — banco
- constraint única em `(user_id, representative_id, hash_linha)`

Isso evita:
- duplicar visita ao importar a mesma planilha duas vezes
- duplicar linha repetida dentro do próprio arquivo
- bloquear indevidamente visitas iguais de representantes diferentes

5. Melhorar o feedback para o usuário
Em vez de erro técnico bruto, o toast vai separar o resultado:
- quantas visitas novas foram importadas
- quantas já existiam no sistema para esse representante
- quantas estavam duplicadas dentro da própria planilha

Exemplo:
```text
120 visitas importadas, 40 já existentes, 3 duplicadas no arquivo
```

Se houver corrida rara de banco por duplicidade, o erro também será tratado com mensagem funcional, não com SQL cru.

Arquivos envolvidos
- `src/components/VisitImport.tsx`
- `supabase/migrations/...sql`

Validação que eu faria após implementar
1. Importar de novo a planilha do Lauro
2. Confirmar que a requisição não usa mais:
```text
on_conflict=user_id,hash_linha
```
Idealmente nem usa `on_conflict`
3. Confirmar que surgem registros em `visitas_importadas` para o `representative_id` do Lauro
4. Confirmar que `weekly_visits` é recalculado e o Lauro deixa de aparecer com zero nas semanas corretas
5. Importar a mesma planilha novamente e verificar que:
- nenhuma visita duplica
- o sistema apenas informa que os registros já existiam

Resultado esperado
- o erro atual de importação desaparece
- as visitas do Lauro passam a gravar corretamente
- o app deixa de esconder visita importada por falha de agregação
- o sistema não duplica registros de visitas
