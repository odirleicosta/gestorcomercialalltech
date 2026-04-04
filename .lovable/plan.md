
Do I know what the issue is? Yes.

Problema exato
- Há 2 falhas ao mesmo tempo:
  1. o app em execução ainda dispara o fluxo antigo de `upsert(... onConflict=user_id,hash_linha)` — isso está provado pelo snapshot de rede;
  2. mesmo quando a importação gravar, `RepKPIs` recarrega principalmente a semana filtrada no momento, então o Lauro pode continuar parecendo zerado se as visitas ficaram em outras semanas.
- O repositório atual já mostra `VisitImport.tsx` sem `upsert`, então o preview do usuário está rodando um bundle antigo ou um fluxo ainda não consolidado.
- As migrations de `visitas_importadas` ficaram fragmentadas: a original criou unicidade em `(user_id, hash_linha)` e as posteriores tentaram corrigir por cima. Precisa consolidar isso de forma idempotente.

Plano final de correção

1. Consolidar o banco
- Criar uma migration única de saneamento para `visitas_importadas` que:
  - remova índices/constraints antigos ligados a `(user_id, hash_linha)`;
  - elimine duplicatas reais por `(user_id, representative_id, hash_linha)` se houver alguma;
  - recrie exatamente 1 índice único correto:
    `UNIQUE (user_id, representative_id, hash_linha)`.
- Resultado: o banco vira a trava final certa e não bloqueia visitas iguais de representantes diferentes.

2. Blindar o importador de visitas
- Revisar `src/components/VisitImport.tsx` para garantir que ele use apenas:
  - leitura da planilha;
  - deduplicação dentro do arquivo;
  - consulta dos hashes já existentes do mesmo representante;
  - `insert()` apenas dos registros novos.
- Sem `upsert` e sem `onConflict`.
- Melhorar a tolerância a corrida: se um lote encontrar `23505`, reprocessar linha a linha para não perder registros válidos por causa de 1 duplicada.

3. Recalcular `weekly_visits` sempre da fonte real
- Após importar, buscar todas as visitas de `visitas_importadas` daquele representante e reconstruir `weekly_visits` do zero.
- Isso evita:
  - somar em cima de dados velhos;
  - inconsistência após reimportação;
  - duplicidade nos totais semanais.

4. Corrigir o “importou mas não aparece”
- Ajustar `src/components/RepKPIs.tsx` para o pós-importação não depender só da semana atualmente selecionada.
- Depois do import:
  - recarregar detalhes completos;
  - recarregar totais anuais;
  - se a semana atual estiver vazia mas houver visitas em outras semanas, informar as semanas importadas e/ou mudar o filtro para a primeira semana com dados.
- Resultado: o Lauro deixa de parecer com zero quando o problema era só o filtro semanal.

5. Validar que o usuário está no bundle certo
- Adicionar um marcador visível no fluxo novo do importador (ex.: texto/toast de versão do import).
- Na validação, confirmar que a requisição nova para `visitas_importadas` não contém `on_conflict`.
- Isso elimina a ambiguidade entre “código já corrigido” e “preview ainda antigo”.

Arquivos envolvidos
- `src/components/VisitImport.tsx`
- `src/components/RepKPIs.tsx`
- `supabase/migrations/...sql`

Validação final
1. Abrir o importador e confirmar o marcador da versão nova.
2. Importar a planilha do Lauro.
3. Confirmar que não existe mais request `...visitas_importadas?on_conflict=...`.
4. Confirmar que surgem registros do Lauro em `visitas_importadas`.
5. Confirmar que `weekly_visits` é recriado corretamente.
6. Reimportar a mesma planilha e verificar:
   - nenhuma duplicação;
   - feedback claro de “já existentes” e “duplicadas no arquivo”.
7. Confirmar que o Lauro aparece no app na semana correta, mesmo que não fosse a semana filtrada antes.

Resultado esperado
- o erro `there is no unique or exclusion constraint matching the ON CONFLICT specification` desaparece;
- o sistema não duplica registros de visitas;
- representantes diferentes podem ter visitas com mesmo hash sem conflito indevido;
- as visitas do Lauro passam a aparecer no app de forma visível e consistente.
