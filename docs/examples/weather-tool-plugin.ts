/**
 * Example Plugin: Weather Tool
 * 
 * This demonstrates how third-party developers can create
 * custom tools for ChatSoap's AI system.
 * 
 * To use this plugin:
 * 1. Import and call the register function in your edge function
 * 2. Enable the tool in admin settings
 * 3. The AI will automatically use it when appropriate
 */

import { registerTool } from "../../supabase/functions/_shared/prompt-system/index.ts";
import type { ToolResult } from "../../supabase/functions/_shared/prompt-system/types.ts";

// ============================================
// STEP 1: Define your tool configuration
// ============================================

const WEATHER_TOOL_CONFIG = {
  id: "get_weather",
  
  // OpenAI-compatible function definition
  // This tells the AI what parameters your tool accepts
  definition: {
    type: "function" as const,
    function: {
      name: "get_weather",
      description: "Get current weather information for a specific location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "City name or location (e.g., 'Stockholm', 'New York')",
          },
          units: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature units",
          },
        },
        required: ["location"],
      },
    },
  },
  
  // Instructions injected into the AI's system prompt
  // Be specific about WHEN to use this tool
  promptInstructions: `Use when the user asks about weather, temperature, or climate conditions for a specific location. 
Always ask for clarification if the location is ambiguous.`,
  
  // Optional: Check if tool should be available
  // Useful for API key validation
  isAvailable: () => {
    const apiKey = Deno.env.get("WEATHER_API_KEY");
    return !!apiKey;
  },
  
  // The actual tool execution logic
  execute: async (args: Record<string, unknown>): Promise<ToolResult> => {
    const location = args.location as string;
    const units = (args.units as string) || "celsius";
    
    try {
      // Example API call (replace with real weather API)
      const apiKey = Deno.env.get("WEATHER_API_KEY");
      
      if (!apiKey) {
        return {
          success: false,
          error: "Weather API key not configured",
        };
      }
      
      // Simulated weather data for demonstration
      // In production, call a real weather API like OpenWeatherMap
      const weatherData = {
        location,
        temperature: units === "celsius" ? 18 : 64,
        units,
        condition: "Partly cloudy",
        humidity: 65,
        wind: "12 km/h NW",
      };
      
      return {
        success: true,
        content: `Weather in ${location}: ${weatherData.temperature}°${units === "celsius" ? "C" : "F"}, ${weatherData.condition}. Humidity: ${weatherData.humidity}%, Wind: ${weatherData.wind}`,
        data: weatherData,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch weather: ${error.message}`,
      };
    }
  },
};

// ============================================
// STEP 2: Register the tool
// ============================================

export function registerWeatherTool(): void {
  registerTool(WEATHER_TOOL_CONFIG);
  console.log("✅ Weather tool registered");
}

// ============================================
// STEP 3: Export for use in edge functions
// ============================================

export default {
  register: registerWeatherTool,
  config: WEATHER_TOOL_CONFIG,
};
