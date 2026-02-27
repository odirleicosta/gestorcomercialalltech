import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfText } = await req.json();
    if (!pdfText || typeof pdfText !== "string" || pdfText.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Texto do PDF vazio ou muito curto para extração." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um assistente que extrai dados estruturados de pedidos/propostas comerciais da Alltech Máquinas.
Analise o texto extraído do PDF e retorne os dados usando a função extract_order_data.
- Valores monetários em USD (dólar) devem ser numéricos sem símbolo (ex: 87580.10)
- Valores em BRL devem ser numéricos sem símbolo
- Datas no formato YYYY-MM-DD
- Se não encontrar um campo, use null
- Para itens, extraia CADA item separadamente (incluindo opcionais como 4º eixo)
- O campo "representante" é o vendedor/contato da Alltech (não o cliente)
- O "tipo_maquina" deve ser um dos: "Centro de Usinagem", "Torno CNC", "Plu.go" ou outro tipo identificado`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Extraia os dados deste pedido:\n\n${pdfText.substring(0, 15000)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_order_data",
              description: "Extrai dados estruturados de um pedido/proposta comercial",
              parameters: {
                type: "object",
                properties: {
                  numero_proposta: { type: "string", description: "Número da proposta/pedido" },
                  cliente_nome: { type: "string", description: "Nome/razão social do cliente" },
                  cliente_contato: { type: "string", description: "Nome do contato do cliente" },
                  cliente_cnpj: { type: "string", description: "CNPJ do cliente" },
                  cliente_endereco: { type: "string", description: "Endereço do cliente" },
                  representante_nome: { type: "string", description: "Nome do representante/vendedor Alltech" },
                  data_pedido: { type: "string", description: "Data do pedido (YYYY-MM-DD)" },
                  tipo_venda: { type: "string", description: "Tipo da venda (Venda, Aluguel, etc)" },
                  itens: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        descricao: { type: "string", description: "Descrição do item (ex: Centro de Usinagem Vertical OKM-1300D Okada)" },
                        tipo_maquina: { type: "string", description: "Tipo: Centro de Usinagem, Torno CNC, Plu.go, etc" },
                        marca: { type: "string", description: "Marca da máquina (ex: Okada)" },
                        modelo: { type: "string", description: "Modelo da máquina (ex: OKM-1300D)" },
                        valor_fob_usd: { type: "number", description: "Valor FOB em USD" },
                        quantidade: { type: "number", description: "Quantidade" },
                        prazo_entrega: { type: "string", description: "Prazo de entrega (YYYY-MM-DD)" },
                      },
                      required: ["descricao", "valor_fob_usd", "quantidade"],
                      additionalProperties: false,
                    },
                  },
                  valor_total_brl: { type: "number", description: "Valor total em BRL" },
                  valor_entrada_brl: { type: "number", description: "Valor de entrada em BRL" },
                  parcelas: { type: "number", description: "Número de parcelas" },
                  valor_parcela_brl: { type: "number", description: "Valor de cada parcela em BRL" },
                  atma_valor: { type: "number", description: "Valor do ATMA em BRL" },
                  notas_comerciais: { type: "string", description: "Notas comerciais adicionais" },
                  comando: { type: "string", description: "Tipo do comando CNC (ex: Mitsubishi M80A, Fanuc 0iMF)" },
                },
                required: ["cliente_nome", "itens"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_order_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    let extractedData = null;

    // Try tool_calls first
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        extractedData = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Tool call parse failed:", e);
      }
    }

    // Fallback: parse JSON from content
    if (!extractedData) {
      const content = result.choices?.[0]?.message?.content || "";
      let cleaned = content.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          extractedData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.error("Content JSON parse failed:", parseError);
        }
      }
    }

    if (!extractedData) {
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair dados do PDF. Tente um PDF com texto selecionável." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ data: extractedData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-order-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
