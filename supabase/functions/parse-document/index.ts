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
    const { documentUrl, documentName, mimeType } = await req.json();

    if (!documentUrl) {
      return new Response(
        JSON.stringify({ error: "documentUrl is required" }),
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

    console.log(`Parsing document to markdown: ${documentName}, type: ${mimeType}`);

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
    const fileSizeMB = (documentBuffer.byteLength / 1024 / 1024).toFixed(2);
    const base64Document = btoa(
      new Uint8Array(documentBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    console.log(`Document fetched, size: ${fileSizeMB}MB`);

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
          text: "Convert this document to well-formatted Markdown. Keep all text, structure, headings, lists, and tables. Return ONLY the markdown content without any explanations or comments.",
        },
      ],
    };

    const systemPrompt = `You are a document converter. Your only task is to convert documents to well-formatted Markdown.

Rules:
- Keep the document structure as close to the original as possible
- Use correct Markdown headings (# ## ### etc.)
- Convert tables to Markdown tables
- Keep lists and numbered lists
- Preserve all text exactly as it is
- Return ONLY the markdown content, no explanations
- If the document contains images, describe them briefly in [brackets]
- Format code blocks with appropriate syntax highlighting if relevant`;

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

    console.log("Streaming markdown response...");

    // Stream the response back
    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("parse-document error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
