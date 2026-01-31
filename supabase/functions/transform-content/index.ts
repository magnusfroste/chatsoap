import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getLLMConfig, validateLLMConfig } from "../_shared/llm-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TransformRequest {
  transformationId: string;
  content: string;
  targetLanguage?: string;
}

// Built-in transformation prompts (fallback if not in DB)
const BUILT_IN_PROMPTS: Record<string, string> = {
  summarize: `Summarize the following content concisely, preserving key information and main points. Respond in the same language as the input.

{{content}}`,
  "extract-action-items": `Extract all action items, tasks, and todos from the following content. Format as a checklist. If no explicit tasks, identify implied next steps.

{{content}}`,
  "key-points": `Extract the main points from this content as clear, concise bullet points. Focus on the most important information.

{{content}}`,
  "generate-qa": `Create 5-10 study questions with answers based on this content. Make questions progressively more challenging.

{{content}}`,
  translate: `Translate the following content to {{targetLanguage}}. Preserve formatting and meaning.

{{content}}`,
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { transformationId, content, targetLanguage } = await req.json() as TransformRequest;

    if (!transformationId || !content) {
      return new Response(
        JSON.stringify({ error: "Missing transformationId or content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[transform-content] Running transformation ${transformationId} for user ${user.id}`);

    // Load transformation from database
    const { data: transformation, error: fetchError } = await supabase
      .from("transformations")
      .select("*")
      .eq("id", transformationId)
      .single();

    if (fetchError || !transformation) {
      console.error("[transform-content] Transformation not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Transformation not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the final prompt
    let prompt = transformation.prompt;
    
    // Replace placeholders
    prompt = prompt.replace(/\{\{content\}\}/g, content);
    if (targetLanguage) {
      prompt = prompt.replace(/\{\{targetLanguage\}\}/g, targetLanguage);
    }

    console.log(`[transform-content] Using transformation: ${transformation.name}`);

    // Get LLM configuration
    const llmConfig = await getLLMConfig();
    validateLLMConfig(llmConfig);

    // Make streaming request to LLM
    const response = await fetch(llmConfig.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${llmConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that processes content according to specific instructions. Be concise and maintain the original language unless translating."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        stream: true,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[transform-content] LLM error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to process transformation" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stream the response back
    const reader = response.body?.getReader();
    if (!reader) {
      return new Response(
        JSON.stringify({ error: "No response stream" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n").filter((line) => line.trim() !== "");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  continue;
                }

                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch {
                  // Skip malformed JSON
                }
              }
            }
          }
        } catch (error) {
          console.error("[transform-content] Stream error:", error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("[transform-content] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
