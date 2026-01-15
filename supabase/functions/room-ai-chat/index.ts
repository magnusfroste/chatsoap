import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { roomId, messageHistory, persona, customSystemPrompt } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build conversation context from message history
    const conversationMessages = messageHistory.map((msg: any) => ({
      role: msg.is_ai ? "assistant" : "user",
      content: msg.is_ai ? msg.content : `[${msg.display_name || "User"}]: ${msg.content}`,
    }));

    console.log("Sending to AI with", conversationMessages.length, "messages, persona:", persona, "custom:", !!customSystemPrompt);

    // Define persona-specific system prompts
    const personaPrompts: Record<string, string> = {
      general: `You are a helpful AI assistant in Silicon Valhalla Meet - an exclusive collaboration platform for the tech elite.

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
    const systemPrompt = customSystemPrompt || personaPrompts[persona] || personaPrompts.general;

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