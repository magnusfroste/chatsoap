import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface LLMConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

async function getLLMConfig(): Promise<LLMConfig> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: settings } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["llm_provider", "llm_openai_model", "llm_gemini_model", "llm_custom_config"]);

  let provider = "lovable";
  let openaiModel = "gpt-4o";
  let geminiModel = "gemini-2.5-flash";
  let customConfig = { url: "", model: "" };

  if (settings) {
    for (const s of settings) {
      if (s.key === "llm_provider" && typeof s.value === "string") provider = s.value;
      if (s.key === "llm_openai_model" && typeof s.value === "string") openaiModel = s.value;
      if (s.key === "llm_gemini_model" && typeof s.value === "string") geminiModel = s.value;
      if (s.key === "llm_custom_config" && s.value && typeof s.value === "object") {
        customConfig = s.value as { url: string; model: string };
      }
    }
  }

  switch (provider) {
    case "openai":
      return {
        endpoint: "https://api.openai.com/v1/chat/completions",
        apiKey: Deno.env.get("OPENAI_API_KEY") || "",
        model: openaiModel,
      };
    case "gemini":
      return {
        endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        apiKey: Deno.env.get("GEMINI_API_KEY") || "",
        model: geminiModel,
      };
    case "custom": {
      // Auto-append /v1/chat/completions if missing
      let endpoint = customConfig.url;
      if (endpoint && !endpoint.includes("/chat/completions")) {
        endpoint = endpoint.replace(/\/$/, "") + "/v1/chat/completions";
      }
      return {
        endpoint,
        apiKey: Deno.env.get("CUSTOM_LLM_API_KEY") || "",
        model: customConfig.model,
      };
    }
    default: // lovable
      return {
        endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
        apiKey: Deno.env.get("LOVABLE_API_KEY") || "",
        model: "google/gemini-2.5-flash",
      };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentUrl, documentName, mimeType, question, messageHistory } = await req.json();

    if (!documentUrl || !question) {
      return new Response(
        JSON.stringify({ error: "documentUrl and question are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const llmConfig = await getLLMConfig();
    
    if (!llmConfig.apiKey) {
      console.error("API key not configured for the selected provider");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing document: ${documentName}, type: ${mimeType}, using: ${llmConfig.model}`);

    // Fetch the document from storage
    const documentResponse = await fetch(documentUrl);
    if (!documentResponse.ok) {
      console.error(`Failed to fetch document: ${documentResponse.status}`);
      return new Response(
        JSON.stringify({ error: "Could not fetch document" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const documentBuffer = await documentResponse.arrayBuffer();
    const base64Document = btoa(
      new Uint8Array(documentBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    console.log(`Document fetched, size: ${documentBuffer.byteLength} bytes`);

    // Build conversation history for context
    const historyMessages = (messageHistory || []).map((msg: { content: string; is_ai: boolean; display_name?: string }) => ({
      role: msg.is_ai ? "assistant" : "user",
      content: msg.content,
    }));

    // Build the multimodal message with document
    const userMessage = {
      role: "user",
      content: [
        {
          type: "file",
          file: {
            filename: documentName || "document",
            file_data: `data:${mimeType};base64,${base64Document}`,
          },
        },
        {
          type: "text",
          text: question,
        },
      ],
    };

    const systemPrompt = `You are a helpful document analysis assistant. You help users understand and analyze documents they attach.

Your tasks:
- Analyze the content of attached documents (PDF, images, etc.)
- Answer questions about the document's content
- Summarize key points
- Extract specific information the user requests
- Explain complex concepts from the document

Always respond in the same language the user writes in. Be concise but informative.
If you cannot read or understand the document, explain this clearly.`;

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
          ...historyMessages,
          userMessage,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`AI gateway error: ${response.status}`, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Contact admin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Streaming AI response...");

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("analyze-document error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
