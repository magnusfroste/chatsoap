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

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// Tool definitions for function calling
const tools = [
  {
    type: "function",
    function: {
      name: "analyze_images",
      description: "Analyze images that the user has attached to the conversation. Use this tool ONLY when the user explicitly asks to analyze, describe, or explain images. Do not call this tool if the user hasn't asked about the images.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What the user wants to know about the images",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Search the web for current information when your knowledge is insufficient or outdated. Use this for: current events, recent news, live data, prices, statistics, or any factual information that might have changed since your training.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find information on the web",
          },
        },
        required: ["query"],
      },
    },
  },
];

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
    
    // For images, skip text extraction - they'll be handled via tool call
    if (isImageFile(file.mimeType)) {
      return `[Image attached: ${file.name}] - Use analyze_images tool if user asks about this image.`;
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
        const maxLength = 50000;
        if (text.length > maxLength) {
          return `[File: ${file.name}]\n${text.substring(0, maxLength)}...\n[Content truncated]`;
        }
        return `[File: ${file.name}]\n${text}`;
      }
    }
    
    return `[Document attached: ${file.name} (${file.mimeType})]`;
  } catch (error) {
    console.error(`Error fetching file ${file.name}:`, error);
    return `[Error loading file: ${file.name}]`;
  }
}

// Convert image URL to base64 data URL for multimodal models
async function fetchImageAsBase64(file: CAGFile): Promise<{ url: string; mimeType: string; name: string } | null> {
  try {
    console.log(`Fetching image for multimodal: ${file.name}`);
    const response = await fetch(file.url);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.status}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    return {
      url: `data:${file.mimeType};base64,${base64}`,
      mimeType: file.mimeType,
      name: file.name,
    };
  } catch (error) {
    console.error(`Error fetching image ${file.name}:`, error);
    return null;
  }
}

// Build context from CAG files (text-based files only)
async function buildCAGFileContext(cagFiles: CAGFile[]): Promise<string> {
  if (!cagFiles || cagFiles.length === 0) {
    return "";
  }

  console.log(`Processing ${cagFiles.length} CAG files for context`);
  
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
---`;
}

// Get image files for tool-based analysis
function getImageFiles(cagFiles: CAGFile[]): CAGFile[] {
  if (!cagFiles || cagFiles.length === 0) {
    return [];
  }
  return cagFiles.filter(f => isImageFile(f.mimeType));
}

// Build context from CAG notes
function buildCAGNoteContext(cagNotes: CAGNote[]): string {
  if (!cagNotes || cagNotes.length === 0) {
    return "";
  }

  console.log(`Processing ${cagNotes.length} CAG notes`);
  
  const noteContents = cagNotes.map(note => {
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

// Build combined CAG context (text only - images handled via tool)
async function buildCAGContext(cagFiles: CAGFile[], cagNotes: CAGNote[]): Promise<string> {
  const [fileContext, noteContext] = await Promise.all([
    buildCAGFileContext(cagFiles),
    Promise.resolve(buildCAGNoteContext(cagNotes)),
  ]);

  const parts = [fileContext, noteContext].filter(Boolean);
  
  if (parts.length === 0) {
    return "";
  }

  return parts.join("\n") + "\nThe user has shared these items for context. Reference them when relevant to their questions.\n";
}

// Execute web search via Firecrawl
async function executeWebSearch(query: string): Promise<string> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  
  if (!apiKey) {
    console.error("FIRECRAWL_API_KEY not configured");
    return "Web search is not available - Firecrawl connector not configured.";
  }

  try {
    console.log(`Executing web search: "${query}"`);
    
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 5,
        scrapeOptions: {
          formats: ["markdown"],
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Firecrawl error: ${response.status}`, errorText);
      return `Web search failed: ${response.status}`;
    }

    const data = await response.json();
    
    if (!data.success || !data.data || data.data.length === 0) {
      return "No results found for this search query.";
    }

    // Format search results
    const results = data.data.slice(0, 5).map((result: any, index: number) => {
      const title = result.title || "Untitled";
      const url = result.url || "";
      const content = result.markdown?.substring(0, 2000) || result.description || "No content available";
      return `### Result ${index + 1}: ${title}\nURL: ${url}\n${content}`;
    });

    console.log(`Web search returned ${results.length} results`);
    return `## Web Search Results for: "${query}"\n\n${results.join("\n\n---\n\n")}`;
  } catch (error) {
    console.error("Web search error:", error);
    return `Web search failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// Execute image analysis with multimodal LLM
async function executeImageAnalysis(
  query: string,
  imageFiles: CAGFile[],
  llmConfig: LLMConfig
): Promise<string> {
  if (imageFiles.length === 0) {
    return "No images are attached to analyze. Please attach images first.";
  }

  try {
    console.log(`Analyzing ${imageFiles.length} images for query: "${query}"`);
    
    // Fetch all images as base64
    const imagePromises = imageFiles.map(file => fetchImageAsBase64(file));
    const images = (await Promise.all(imagePromises)).filter(Boolean) as Array<{ url: string; mimeType: string; name: string }>;
    
    if (images.length === 0) {
      return "Could not load the attached images for analysis.";
    }

    // Build multimodal message
    const imageNames = images.map(img => img.name).join(", ");
    const multimodalContent: any[] = [
      {
        type: "text",
        text: `Analyze the following ${images.length} image(s): ${imageNames}\n\nUser's question: ${query}\n\nProvide a detailed analysis addressing the user's question.`,
      },
    ];

    for (const img of images) {
      multimodalContent.push({
        type: "image_url",
        image_url: { url: img.url },
      });
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
          {
            role: "system",
            content: "You are an expert image analyst. Analyze images thoroughly and provide detailed, accurate descriptions and insights. Answer the user's specific questions about the images.",
          },
          {
            role: "user",
            content: multimodalContent,
          },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Image analysis LLM error: ${response.status}`, errorText);
      return "Image analysis failed - could not process the images.";
    }

    const data = await response.json();
    const analysisResult = data.choices?.[0]?.message?.content;
    
    if (!analysisResult) {
      return "Image analysis completed but no result was returned.";
    }

    console.log("Image analysis completed successfully");
    return analysisResult;
  } catch (error) {
    console.error("Image analysis error:", error);
    return `Image analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

// Process tool calls and return results
async function processToolCalls(
  toolCalls: ToolCall[],
  imageFiles: CAGFile[],
  llmConfig: LLMConfig
): Promise<Array<{ tool_call_id: string; role: "tool"; content: string }>> {
  const results = await Promise.all(
    toolCalls.map(async (toolCall) => {
      const args = JSON.parse(toolCall.function.arguments);
      let result: string;

      switch (toolCall.function.name) {
        case "analyze_images":
          result = await executeImageAnalysis(args.query, imageFiles, llmConfig);
          break;
        case "web_search":
          result = await executeWebSearch(args.query);
          break;
        default:
          result = `Unknown tool: ${toolCall.function.name}`;
      }

      return {
        tool_call_id: toolCall.id,
        role: "tool" as const,
        content: result,
      };
    })
  );

  return results;
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

    // Build CAG context from files and notes (text only)
    const cagContext = await buildCAGContext(cagFiles || [], cagNotes || []);
    
    // Get image files for potential tool use
    const imageFiles = getImageFiles(cagFiles || []);

    // Build conversation context from message history
    const conversationMessages = messageHistory.map((msg: any) => ({
      role: msg.is_ai ? "assistant" : "user",
      content: msg.is_ai ? msg.content : `[${msg.display_name || "User"}]: ${msg.content}`,
    }));

    console.log("Using LLM:", llmConfig.model, "at", llmConfig.endpoint);
    console.log("Sending", conversationMessages.length, "messages, persona:", persona);
    console.log("CAG files:", cagFiles?.length || 0, "images available for tool:", imageFiles.length);

    // Define persona-specific system prompts
    const personaPrompts: Record<string, string> = {
      general: `You are a helpful AI assistant in Messem - an exclusive collaboration platform for the tech elite.

You participate in a room where multiple users can ask questions and discuss together with you.
Messages from users are shown with their name in brackets, e.g. "[Anna]: Hello!"
Always respond in the same language the user writes in.

You have access to tools:
- analyze_images: Use ONLY when the user explicitly asks to analyze, describe, or explain attached images
- web_search: Use when you need current/recent information that might be outdated in your training data

Be:
- Concise but informative
- Technically knowledgeable
- Friendly and collaborative
- Creative when appropriate

If someone asks something you don't know, use web_search to find current information.`,

      code: `You are an expert code assistant with deep knowledge in programming and software development.

You have access to tools:
- analyze_images: Use when user asks about images (screenshots, diagrams, code images)
- web_search: Use to find documentation, latest API info, or solve technical problems

You help users with:
- Writing, reviewing, and improving code
- Debugging bugs and solving technical problems
- Explaining concepts and design patterns
- Suggesting best practices and optimizations

Always respond in the same language the user writes in.
Use code blocks with syntax highlighting when showing code.`,

      writer: `You are a skilled writing assistant who helps with everything from creative writing to professional communication.

You have access to tools:
- analyze_images: Use when user asks about images for writing context
- web_search: Use to research topics, find facts, or verify information

You help users with:
- Formulating and improving texts
- Proofreading and providing feedback on structure
- Adapting tone and style for different audiences
- Writing emails, reports, articles, and other content

Always respond in the same language the user writes in.`,

      creative: `You are a creative brainstorming partner full of ideas and inspiration!

You have access to tools:
- analyze_images: Use when user asks about images for creative inspiration
- web_search: Use to find inspiration, trends, or reference material

You help users with:
- Generating innovative ideas and concepts
- Thinking outside the box and challenging assumptions
- Developing concepts through "what if" scenarios

Always respond in the same language the user writes in.
Be enthusiastic, open, and playful in your approach!`,

      learning: `You are a pedagogical mentor who adapts explanations to the user's level.

You have access to tools:
- analyze_images: Use when user asks about images for learning (diagrams, charts, etc.)
- web_search: Use to find educational resources, examples, or verify facts

You help users with:
- Explaining complex topics in an understandable way
- Breaking down large concepts into smaller parts
- Giving examples and analogies that make abstract concrete

Always respond in the same language the user writes in.
Start with the basics and build understanding gradually.`,
    };

    // Use custom system prompt if provided, otherwise use built-in persona
    let systemPrompt = customSystemPrompt || personaPrompts[persona] || personaPrompts.general;
    
    // Append CAG context to system prompt if present
    if (cagContext) {
      systemPrompt = `${systemPrompt}\n\n${cagContext}`;
    }

    // Add note about available images if any are attached
    if (imageFiles.length > 0) {
      const imageNames = imageFiles.map(f => f.name).join(", ");
      systemPrompt += `\n\nNote: The user has attached ${imageFiles.length} image(s): ${imageNames}. Use the analyze_images tool ONLY if the user explicitly asks to analyze or describe these images.`;
    }

    // Build messages for LLM
    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...conversationMessages,
    ];

    // Check if Firecrawl is available for tool use
    const firecrawlAvailable = !!Deno.env.get("FIRECRAWL_API_KEY");
    const availableTools = tools.filter(tool => {
      if (tool.function.name === "web_search" && !firecrawlAvailable) {
        return false;
      }
      if (tool.function.name === "analyze_images" && imageFiles.length === 0) {
        return false;
      }
      return true;
    });

    console.log("Available tools:", availableTools.map(t => t.function.name).join(", ") || "none");

    // First LLM call - may include tool calls
    const firstResponse = await fetch(llmConfig.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llmConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages,
        tools: availableTools.length > 0 ? availableTools : undefined,
        tool_choice: availableTools.length > 0 ? "auto" : undefined,
        stream: false, // First call non-streaming to check for tool calls
      }),
    });

    if (!firstResponse.ok) {
      if (firstResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please wait and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (firstResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Contact admin." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await firstResponse.text();
      console.error("AI gateway error:", firstResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const firstData = await firstResponse.json();
    const assistantMessage = firstData.choices?.[0]?.message;

    // Check if there are tool calls to process
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log("Processing", assistantMessage.tool_calls.length, "tool call(s)");
      
      // Process tool calls
      const toolResults = await processToolCalls(
        assistantMessage.tool_calls,
        imageFiles,
        llmConfig
      );

      // Build messages with tool results for second LLM call
      const messagesWithTools = [
        ...messages,
        {
          role: "assistant",
          content: assistantMessage.content || null,
          tool_calls: assistantMessage.tool_calls,
        },
        ...toolResults,
      ];

      // Second LLM call with tool results - this one streams
      const secondResponse = await fetch(llmConfig.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${llmConfig.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: llmConfig.model,
          messages: messagesWithTools,
          stream: true,
        }),
      });

      if (!secondResponse.ok) {
        const errorText = await secondResponse.text();
        console.error("Second AI call error:", secondResponse.status, errorText);
        return new Response(
          JSON.stringify({ error: "AI gateway error" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Streaming final response after tool use");
      return new Response(secondResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls - stream the response directly
    // We need to re-call with streaming since first call was non-streaming
    console.log("No tool calls, streaming direct response");
    
    const streamResponse = await fetch(llmConfig.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llmConfig.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: llmConfig.model,
        messages,
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text();
      console.error("Stream response error:", streamResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(streamResponse.body, {
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
