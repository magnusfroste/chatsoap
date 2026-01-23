import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getLLMConfig, validateLLMConfig } from "../_shared/llm-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    
    try {
      validateLLMConfig(llmConfig);
    } catch {
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
