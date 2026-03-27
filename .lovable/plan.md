

# Plano: Cadastro de Negociação via Upload de Imagem no Radar

Permitir que o gestor faça upload de uma foto (print de WhatsApp, proposta escaneada, etc.) e o sistema extraia automaticamente os dados para preencher o formulário de nova negociação.

---

## 1. Nova Edge Function `parse-closing-image`

Criar `supabase/functions/parse-closing-image/index.ts` que:
- Recebe uma imagem em base64 via POST
- Envia para o Lovable AI Gateway usando `google/gemini-2.5-flash` (modelo com capacidade de visão)
- Usa function calling com schema mapeado aos campos do `closing_deals` (client_name, city, machine_name, machine_type, quantity, deal_value, sale_type, competitor, etc.)
- Retorna JSON estruturado com os campos extraídos

---

## 2. Botão de Upload no ClosingRadar

Adicionar um botão "Importar Imagem" ao lado do botão "Nova Negociação" existente. Ao clicar:
- Abre seletor de arquivo (accept: image/*)
- Converte a imagem para base64
- Mostra estado de loading
- Chama a edge function
- Preenche o formulário de cadastro com os dados extraídos pela IA
- Abre o Dialog de cadastro já pré-preenchido para revisão

---

## 3. Arquivos impactados

| Arquivo | Ação |
|---|---|
| `supabase/functions/parse-closing-image/index.ts` | **Novo** — edge function de visão |
| `src/components/ClosingRadar.tsx` | Adicionar botão de upload e lógica de pré-preenchimento |

Nenhuma funcionalidade existente será alterada.

