import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getLLMConfig, validateLLMConfig } from "../_shared/llm-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, content, targetLanguage } = await req.json();
    
    const llmConfig = await getLLMConfig();
    validateLLMConfig(llmConfig);

    let systemPrompt = "";
    let userPrompt = "";

    switch (action) {
      case "summarize":
        systemPrompt = "You are a helpful assistant that summarizes text concisely while keeping the key points. Respond in the same language as the input text.";
        userPrompt = `Please summarize the following text:\n\n${content}`;
        break;
      case "enhance":
        systemPrompt = "You are a helpful writing assistant. Improve the text by making it clearer, more engaging, and better structured. Keep the same language and tone. Respond in the same language as the input text.";
        userPrompt = `Please enhance and improve the following text:\n\n${content}`;
        break;
      case "translate":
        systemPrompt = `You are a professional translator. Translate the text accurately to ${targetLanguage || "English"} while maintaining the original meaning and tone.`;
        userPrompt = `Please translate the following text to ${targetLanguage || "English"}:\n\n${content}`;
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    console.log(`Processing ${action} request using ${llmConfig.model}`);

    const response = await fetch(llmConfig.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llmConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("notes-ai error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
