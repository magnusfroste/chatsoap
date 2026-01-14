import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing document: ${documentName}, type: ${mimeType}`);

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

    const systemPrompt = `Du är en hjälpsam dokumentanalysassistent. Du hjälper användare att förstå och analysera dokument som de bifogar.

Dina uppgifter:
- Analysera innehållet i bifogade dokument (PDF, bilder, etc.)
- Svara på frågor om dokumentets innehåll
- Sammanfatta viktiga punkter
- Extrahera specifik information som användaren efterfrågar
- Förklara komplexa koncept från dokumentet

Svara alltid på svenska om inte användaren frågar på annat språk. Var koncis men informativ.
Om du inte kan läsa eller förstå dokumentet, förklara detta tydligt.`;

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
