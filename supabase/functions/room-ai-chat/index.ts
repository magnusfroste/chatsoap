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

interface CAGFile {
  id: string;
  url: string;
  name: string;
  mimeType: string;
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
    case "custom":
      return {
        endpoint: customConfig.url,
        apiKey: Deno.env.get("CUSTOM_LLM_API_KEY") || "",
        model: customConfig.model,
      };
    default: // lovable
      return {
        endpoint: "https://ai.gateway.lovable.dev/v1/chat/completions",
        apiKey: Deno.env.get("LOVABLE_API_KEY") || "",
        model: "google/gemini-2.5-flash",
      };
  }
}

// Fetch text content from a file URL
async function fetchFileContent(file: CAGFile): Promise<string | null> {
  try {
    console.log(`Fetching CAG file: ${file.name} (${file.mimeType})`);
    
    // For images, we can't extract text - just note they're attached
    if (file.mimeType.startsWith("image/")) {
      return `[Image attached: ${file.name}]`;
    }
    
    // For PDFs and documents, fetch and extract text
    if (file.mimeType === "application/pdf") {
      // For PDFs, we'd need a PDF parsing library - for now, note it's attached
      // The parse-document edge function could be used here for full extraction
      return `[PDF document attached: ${file.name}] - Note: Full PDF content extraction requires additional processing.`;
    }
    
    // For text-based files, fetch directly
    if (file.mimeType.startsWith("text/") || 
        file.mimeType === "application/json" ||
        file.mimeType === "application/xml") {
      const response = await fetch(file.url);
      if (response.ok) {
        const text = await response.text();
        // Limit text size to prevent context overflow
        const maxLength = 50000;
        if (text.length > maxLength) {
          return `[File: ${file.name}]\n${text.substring(0, maxLength)}...\n[Content truncated]`;
        }
        return `[File: ${file.name}]\n${text}`;
      }
    }
    
    // For other document types
    return `[Document attached: ${file.name} (${file.mimeType})]`;
  } catch (error) {
    console.error(`Error fetching file ${file.name}:`, error);
    return `[Error loading file: ${file.name}]`;
  }
}

// Build context from CAG files
async function buildCAGContext(cagFiles: CAGFile[]): Promise<string> {
  if (!cagFiles || cagFiles.length === 0) {
    return "";
  }

  console.log(`Processing ${cagFiles.length} CAG files`);
  
  const fileContents = await Promise.all(
    cagFiles.map(file => fetchFileContent(file))
  );
  
  const validContents = fileContents.filter(Boolean);
  
  if (validContents.length === 0) {
    return "";
  }

  return `
---
CONTEXT FILES (${validContents.length} file(s) provided by user):
${validContents.join("\n\n")}
---
The user has shared these files for context. Reference them when relevant to their questions.
`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomId, messageHistory, persona, customSystemPrompt, cagFiles } = await req.json();
    
    const llmConfig = await getLLMConfig();
    
    if (!llmConfig.apiKey) {
      throw new Error(`API key not configured for the selected provider`);
    }

    // Build CAG context from files
    const cagContext = await buildCAGContext(cagFiles || []);

    // Build conversation context from message history
    const conversationMessages = messageHistory.map((msg: any) => ({
      role: msg.is_ai ? "assistant" : "user",
      content: msg.is_ai ? msg.content : `[${msg.display_name || "User"}]: ${msg.content}`,
    }));

    console.log("Using LLM:", llmConfig.model, "at", llmConfig.endpoint);
    console.log("Sending", conversationMessages.length, "messages, persona:", persona);
    console.log("CAG files:", cagFiles?.length || 0);

    // Define persona-specific system prompts
    const personaPrompts: Record<string, string> = {
      general: `You are a helpful AI assistant in Messem - an exclusive collaboration platform for the tech elite.

You participate in a room where multiple users can ask questions and discuss together with you.
Messages from users are shown with their name in brackets, e.g. "[Anna]: Hello!"
Always respond in the same language the user writes in.

Be:
- Concise but informative
- Technically knowledgeable
- Friendly and collaborative
- Creative when appropriate

If someone asks something you don't know, be honest about it. You can speculate but be clear that it's speculation.`,

      code: `You are an expert code assistant with deep knowledge in programming and software development.

You help users with:
- Writing, reviewing, and improving code
- Debugging bugs and solving technical problems
- Explaining concepts and design patterns
- Suggesting best practices and optimizations
- Providing code examples in various programming languages

Always respond in the same language the user writes in.
Use code blocks with syntax highlighting when showing code.
Be concise but thorough - explain why, not just how.
If you see potential problems or security risks, point them out proactively.`,

      writer: `You are a skilled writing assistant who helps with everything from creative writing to professional communication.

You help users with:
- Formulating and improving texts
- Proofreading and providing feedback on structure
- Adapting tone and style for different audiences
- Writing emails, reports, articles, and other content
- Brainstorming ideas and creating drafts

Always respond in the same language the user writes in.
Give constructive feedback and suggestions for improvements.
Pay attention to grammar, style, and readability.
Adapt your tone to the user's needs - formal or informal.`,

      creative: `You are a creative brainstorming partner full of ideas and inspiration!

You help users with:
- Generating innovative ideas and concepts
- Thinking outside the box and challenging assumptions
- Developing concepts through "what if" scenarios
- Combining unexpected elements in new ways
- Building on the user's ideas

Always respond in the same language the user writes in.
Be enthusiastic, open, and playful in your approach!
Suggest multiple alternatives and variations.
Encourage wild ideas - there are no bad suggestions in brainstorming!
Feel free to use metaphors, analogies, and unexpected connections.`,

      learning: `You are a pedagogical mentor who adapts explanations to the user's level.

You help users with:
- Explaining complex topics in an understandable way
- Breaking down large concepts into smaller parts
- Giving examples and analogies that make abstract concrete
- Asking questions that help the user think for themselves
- Recommending resources for further learning

Always respond in the same language the user writes in.
Start with the basics and build understanding gradually.
Check understanding by asking follow-up questions.
Celebrate progress and encourage curiosity!
Adapt complexity based on the user's prior knowledge.`,
    };

    // Use custom system prompt if provided, otherwise use built-in persona
    let systemPrompt = customSystemPrompt || personaPrompts[persona] || personaPrompts.general;
    
    // Append CAG context to system prompt if present
    if (cagContext) {
      systemPrompt = `${systemPrompt}\n\n${cagContext}`;
    }

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
          ...conversationMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Contact admin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("room-ai-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
