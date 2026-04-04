
Objetivo: corrigir o motivo real de o sistema marcar as visitas do Lauro como “duplicadas” sem elas aparecerem no app.

1. Confirmar a causa raiz dupla
- O código-fonte atual de `VisitImport.tsx` já está certo: usa `onConflict: "user_id,representative_id,hash_linha"`.
- Mas o tráfego do navegador ainda mostra `on_conflict=user_id,hash_linha`, então a interface em execução está com a lógica antiga.
- Além disso, a migration aplicada antes não removeu o índice antigo real. O índice original criado foi:
```text
visitas_importadas_hash_unique (user_id, hash_linha)
```
- A migration nova tentou remover nomes diferentes, então o bloqueio antigo provavelmente continua ativo no banco.

2. Corrigir o banco de dados
Criar uma nova migration para:
- remover explicitamente o índice antigo `visitas_importadas_hash_unique`
- garantir que só exista a unicidade correta:
```text
(user_id, representative_id, hash_linha)
```
Isso evita que visitas iguais de representantes diferentes sejam barradas como duplicadas.

3. Garantir que a interface use a versão nova
Revisar o fluxo de importação para garantir que a versão publicada/preview use mesmo:
```text
onConflict: "user_id,representative_id,hash_linha"
```
Como o snapshot de rede ainda mostra o parâmetro antigo, vou tratar isso como problema de bundle/preview desatualizado e validar a importação na versão atualizada.

4. Validar o comportamento após o ajuste
Depois da correção:
- reimportar a planilha do Lauro
- confirmar que a requisição sai com:
```text
on_conflict=user_id,representative_id,hash_linha
```
- confirmar que surgem registros em `visitas_importadas` para o `representative_id` do Lauro
- confirmar que `weekly_visits` é preenchido para as semanas corretas

5. Evitar falso negativo na tela
Há um detalhe importante: a tela de visitas mostra a semana selecionada. No snapshot atual, o app está filtrando a semana 14, enquanto as visitas do Lauro da planilha estão principalmente entre as semanas 2 e 12.
Então, na validação eu também vou conferir:
- o detalhamento de visitas importadas
- semanas anteriores onde o Lauro realmente tem visitas
Isso evita concluir errado que “não entrou” quando, na verdade, entrou em outra semana.

Detalhes técnicos
```text
Problema 1:
- frontend rodando ainda com on_conflict antigo

Problema 2:
- migration anterior não removeu o índice real:
  visitas_importadas_hash_unique (user_id, hash_linha)

Efeito:
- o banco continua tratando duplicidade no nível do usuário inteiro
- Lauro fica bloqueado se outra pessoa já tiver visita com mesmo hash
- mesmo após importar, a semana visível pode continuar zerada se o filtro estiver em outra semana
```

Arquivos envolvidos
- `supabase/migrations/...sql`
- `src/components/VisitImport.tsx`

Resultado esperado
- visitas do Lauro deixam de ser barradas por conflito de outro representante
- a importação passa a gravar os registros dele corretamente
- os dados aparecem no detalhamento e nas semanas correspondentes
