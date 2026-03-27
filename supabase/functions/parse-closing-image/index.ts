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
    const { imageBase64 } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string" || imageBase64.length < 100) {
      return new Response(
        JSON.stringify({ error: "Imagem inválida ou muito pequena." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Você é um assistente que extrai dados de negociações comerciais a partir de imagens.
A imagem pode ser um print de WhatsApp, uma proposta comercial, um e-mail, uma planilha ou qualquer documento comercial.
Extraia o máximo de informações possíveis usando a função extract_closing_deal.
- Valores monetários devem ser numéricos sem símbolo (ex: 87580.10)
- Se não encontrar um campo, use null
- O campo "machine_type" deve ser um dos: "Centro de Usinagem", "Torno CNC", "Plu.go" ou outro tipo identificado
- O campo "sale_type" deve ser "Venda Direta" ou "Rentall"
- O campo "probability" deve ser "Alta", "Média" ou "Baixa" (infira com base no contexto)
- O campo "stage" deve ser "Proposta Enviada", "Negociação Ativa" ou "Decisão Próxima" (infira com base no contexto)`;

    // Detect mime type from base64 prefix or default to jpeg
    let mimeType = "image/jpeg";
    let cleanBase64 = imageBase64;
    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:(image\/\w+);base64,/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados desta imagem de negociação comercial:" },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${cleanBase64}` },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_closing_deal",
              description: "Extrai dados de uma negociação comercial a partir de uma imagem",
              parameters: {
                type: "object",
                properties: {
                  client_name: { type: "string", description: "Nome do cliente/empresa" },
                  city: { type: "string", description: "Cidade do cliente" },
                  machine_name: { type: "string", description: "Nome/modelo da máquina (ex: OKM-1300D)" },
                  machine_type: { type: "string", description: "Tipo: Centro de Usinagem, Torno CNC, Plu.go, etc" },
                  quantity: { type: "number", description: "Quantidade de máquinas" },
                  deal_value: { type: "number", description: "Valor da negociação em USD" },
                  sale_type: { type: "string", enum: ["Venda Direta", "Rentall"], description: "Tipo de venda" },
                  stage: { type: "string", enum: ["Proposta Enviada", "Negociação Ativa", "Decisão Próxima"], description: "Estágio da negociação" },
                  probability: { type: "string", enum: ["Alta", "Média", "Baixa"], description: "Probabilidade de fechamento" },
                  competitor: { type: "string", description: "Concorrente mencionado" },
                  trade_in: { type: "boolean", description: "Se há máquina usada envolvida" },
                  main_objection: { type: "string", description: "Principal objeção do cliente" },
                  next_step: { type: "string", description: "Próximo passo identificado" },
                  notes: { type: "string", description: "Observações ou contexto adicional extraído" },
                  representative_name: { type: "string", description: "Nome do vendedor/representante mencionado" },
                },
                required: ["client_name"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_closing_deal" } },
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
        JSON.stringify({ error: "Erro ao processar imagem com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    let extractedData = null;

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        extractedData = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("Tool call parse failed:", e);
      }
    }

    if (!extractedData) {
      const content = result.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
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
        JSON.stringify({ error: "Não foi possível extrair dados da imagem. Tente uma imagem com mais informações." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ data: extractedData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-closing-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
