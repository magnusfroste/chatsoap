import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface LLMConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

export interface CustomLLMConfig {
  url: string;
  model: string;
}

/**
 * Fetches LLM configuration from app_settings and returns the appropriate
 * endpoint, API key, and model based on the configured provider.
 * 
 * Supported providers:
 * - lovable (default): Uses Lovable AI gateway
 * - openai: Uses OpenAI API
 * - gemini: Uses Google Gemini API
 * - custom: Uses a custom OpenAI-compatible endpoint
 */
export async function getLLMConfig(): Promise<LLMConfig> {
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
  let customConfig: CustomLLMConfig = { url: "", model: "" };

  if (settings) {
    for (const s of settings) {
      if (s.key === "llm_provider" && typeof s.value === "string") {
        provider = s.value;
      }
      if (s.key === "llm_openai_model" && typeof s.value === "string") {
        openaiModel = s.value;
      }
      if (s.key === "llm_gemini_model" && typeof s.value === "string") {
        geminiModel = s.value;
      }
      if (s.key === "llm_custom_config" && s.value && typeof s.value === "object") {
        customConfig = s.value as CustomLLMConfig;
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

/**
 * Validates that the LLM configuration has an API key set.
 * Throws an error if the API key is missing.
 */
export function validateLLMConfig(config: LLMConfig): void {
  if (!config.apiKey) {
    throw new Error("API key not configured for the selected provider");
  }
}
