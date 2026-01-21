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

interface CAGNote {
  id: string;
  title: string;
  content: string;
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

// Parse document (PDF, DOCX, etc.) using the parse-document edge function
async function parseDocumentContent(file: CAGFile): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    console.log(`Parsing document via parse-document: ${file.name} (${file.mimeType})`);
    
    const response = await fetch(`${supabaseUrl}/functions/v1/parse-document`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        documentUrl: file.url,
        documentName: file.name,
        mimeType: file.mimeType,
      }),
    });

    if (!response.ok) {
      console.error(`parse-document error: ${response.status}`);
      return `[Document attached: ${file.name}] - Could not extract text.`;
    }

    // Read the streaming response and collect markdown
    const reader = response.body?.getReader();
    if (!reader) {
      return `[Document attached: ${file.name}] - No response body.`;
    }

    let markdown = "";
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      // Parse SSE format: data: {"choices":[{"delta":{"content":"..."}}]}
      const lines = chunk.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ") && !line.includes("[DONE]")) {
          try {
            const json = JSON.parse(line.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              markdown += content;
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }

    if (markdown.trim()) {
      // Limit size to prevent context overflow
      const maxLength = 80000;
      if (markdown.length > maxLength) {
        return `[Document: ${file.name}]\n${markdown.substring(0, maxLength)}...\n[Content truncated]`;
      }
      return `[Document: ${file.name}]\n${markdown}`;
    }
    
    return `[Document attached: ${file.name}] - No text extracted.`;
  } catch (error) {
    console.error(`Error parsing document ${file.name}:`, error);
    return `[Document attached: ${file.name}] - Error during extraction.`;
  }
}

// Check if file is a parseable document type
function isParseableDocument(mimeType: string): boolean {
  const parseableMimeTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/rtf",
  ];
  return parseableMimeTypes.includes(mimeType);
}

// Check if file is an image
function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith("image/") && 
    ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType);
}

// Fetch text content from a file URL (for non-image files)
async function fetchFileContent(file: CAGFile): Promise<string | null> {
  try {
    console.log(`Fetching CAG file: ${file.name} (${file.mimeType})`);
    
    // For images, skip text extraction - they'll be handled as multimodal content
    if (isImageFile(file.mimeType)) {
      return null; // Return null to indicate image should be processed separately
    }
    
    // For PDFs and Office documents, use parse-document for full extraction
    if (isParseableDocument(file.mimeType)) {
      return await parseDocumentContent(file);
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

// Convert image URL to base64 data URL for multimodal models
async function fetchImageAsBase64(file: CAGFile): Promise<{ url: string; mimeType: string } | null> {
  try {
    console.log(`Fetching image for multimodal: ${file.name}`);
    const response = await fetch(file.url);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    // Convert to base64
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    return {
      url: `data:${file.mimeType};base64,${base64}`,
      mimeType: file.mimeType,
    };
  } catch (error) {
    console.error(`Error fetching image ${file.name}:`, error);
    return null;
  }
}

// Build context from CAG files (excluding images which are handled separately)
async function buildCAGFileContext(cagFiles: CAGFile[]): Promise<string> {
  if (!cagFiles || cagFiles.length === 0) {
    return "";
  }

  // Filter out images - they'll be processed separately for multimodal
  const nonImageFiles = cagFiles.filter(f => !isImageFile(f.mimeType));
  
  if (nonImageFiles.length === 0) {
    return "";
  }

  console.log(`Processing ${nonImageFiles.length} non-image CAG files`);
  
  const fileContents = await Promise.all(
    nonImageFiles.map(file => fetchFileContent(file))
  );
  
  const validContents = fileContents.filter(Boolean);
  
  if (validContents.length === 0) {
    return "";
  }

  return `
---
CONTEXT FILES (${validContents.length} file(s) provided by user):
${validContents.join("\n\n")}
---`;
}

// Get image files for multimodal processing
async function getImageFilesForMultimodal(cagFiles: CAGFile[]): Promise<Array<{ url: string; name: string }>> {
  if (!cagFiles || cagFiles.length === 0) {
    return [];
  }

  const imageFiles = cagFiles.filter(f => isImageFile(f.mimeType));
  
  if (imageFiles.length === 0) {
    return [];
  }

  console.log(`Processing ${imageFiles.length} images for multimodal`);
  
  const results = await Promise.all(
    imageFiles.map(async (file) => {
      const base64Data = await fetchImageAsBase64(file);
      if (base64Data) {
        return { url: base64Data.url, name: file.name };
      }
      return null;
    })
  );

  return results.filter(Boolean) as Array<{ url: string; name: string }>;
}

// Build context from CAG notes
function buildCAGNoteContext(cagNotes: CAGNote[]): string {
  if (!cagNotes || cagNotes.length === 0) {
    return "";
  }

  console.log(`Processing ${cagNotes.length} CAG notes`);
  
  const noteContents = cagNotes.map(note => {
    // Truncate very long notes
    const maxLength = 30000;
    let content = note.content;
    if (content.length > maxLength) {
      content = content.substring(0, maxLength) + "...\n[Note content truncated]";
    }
    return `[Note: ${note.title}]\n${content}`;
  });

  return `
---
CONTEXT NOTES (${cagNotes.length} note(s) provided by user):
${noteContents.join("\n\n")}
---`;
}

interface CAGContextResult {
  textContext: string;
  images: Array<{ url: string; name: string }>;
}

// Build combined CAG context
async function buildCAGContext(cagFiles: CAGFile[], cagNotes: CAGNote[]): Promise<CAGContextResult> {
  const [fileContext, noteContext, images] = await Promise.all([
    buildCAGFileContext(cagFiles),
    Promise.resolve(buildCAGNoteContext(cagNotes)),
    getImageFilesForMultimodal(cagFiles),
  ]);

  const parts = [fileContext, noteContext].filter(Boolean);
  
  let textContext = "";
  if (parts.length > 0) {
    textContext = parts.join("\n") + "\nThe user has shared these items for context. Reference them when relevant to their questions.\n";
  }

  return { textContext, images };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomId, messageHistory, persona, customSystemPrompt, cagFiles, cagNotes } = await req.json();
    
    const llmConfig = await getLLMConfig();
    
    if (!llmConfig.apiKey) {
      throw new Error(`API key not configured for the selected provider`);
    }

    // Build CAG context from files and notes
    const cagResult = await buildCAGContext(cagFiles || [], cagNotes || []);

    // Build conversation context from message history
    const conversationMessages = messageHistory.map((msg: any) => ({
      role: msg.is_ai ? "assistant" : "user",
      content: msg.is_ai ? msg.content : `[${msg.display_name || "User"}]: ${msg.content}`,
    }));

    console.log("Using LLM:", llmConfig.model, "at", llmConfig.endpoint);
    console.log("Sending", conversationMessages.length, "messages, persona:", persona);
    console.log("CAG files:", cagFiles?.length || 0, "images:", cagResult.images.length);

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
    
    // Append CAG text context to system prompt if present
    if (cagResult.textContext) {
      systemPrompt = `${systemPrompt}\n\n${cagResult.textContext}`;
    }

    // Build the messages array, adding images to the last user message for multimodal
    let finalMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...conversationMessages,
    ];

    // If we have images, convert the last user message to multimodal format
    if (cagResult.images.length > 0 && conversationMessages.length > 0) {
      // Find the last user message index in the final messages array
      let lastUserIndex = -1;
      for (let i = finalMessages.length - 1; i >= 0; i--) {
        if (finalMessages[i].role === "user") {
          lastUserIndex = i;
          break;
        }
      }

      if (lastUserIndex !== -1) {
        const lastUserMsg = finalMessages[lastUserIndex];
        const imageNames = cagResult.images.map(img => img.name).join(", ");
        
        // Build multimodal content array: text first, then images
        const multimodalContent: any[] = [
          { 
            type: "text", 
            text: `${lastUserMsg.content}\n\n[The user has shared ${cagResult.images.length} image(s) for context: ${imageNames}. Analyze and reference them as needed.]`
          },
        ];

        // Add each image
        for (const img of cagResult.images) {
          multimodalContent.push({
            type: "image_url",
            image_url: { url: img.url },
          });
        }

        // Replace the last user message with multimodal version
        finalMessages[lastUserIndex] = {
          role: "user",
          content: multimodalContent,
        };

        console.log(`Added ${cagResult.images.length} images to multimodal message`);
      }
    }

    const response = await fetch(llmConfig.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llmConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages: finalMessages,
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
