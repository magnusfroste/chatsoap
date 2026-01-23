/**
 * Prompt Builder
 * 
 * Composes the final system prompt from modular components.
 * This is the main entry point for the prompt system.
 */

import { BASE_PROMPT, getLanguageInstruction, getFormatInstruction } from "./base-prompt.ts";
import { getPersona, getAllPersonas } from "./persona-registry.ts";
import { getAvailableTools, buildToolInstructions, getTool, getAllTools } from "./tool-registry.ts";
import { buildContext } from "./context-providers.ts";
import type { PromptBuilderConfig, PromptBuildResult, ToolModule, PersonaModule } from "./types.ts";

export interface BuildOptions {
  /** Include base prompt */
  includeBase?: boolean;
  
  /** Language for responses */
  language?: string;
  
  /** Response format style */
  formatStyle?: "concise" | "detailed" | "conversational";
}

/**
 * Build a complete system prompt from modular components
 */
export async function buildSystemPrompt(
  config: PromptBuilderConfig,
  options: BuildOptions = {}
): Promise<PromptBuildResult> {
  const { includeBase = true, language, formatStyle = "conversational" } = options;
  
  const parts: string[] = [];
  const metadata = {
    persona: config.persona,
    enabledTools: [] as string[],
    contextProviders: [] as string[],
  };
  
  // 1. Base prompt (unless custom system prompt provided)
  if (!config.customSystemPrompt && includeBase) {
    parts.push(BASE_PROMPT);
  }
  
  // 2. Persona-specific prompt
  if (config.customSystemPrompt) {
    parts.push(config.customSystemPrompt);
    metadata.persona = "custom";
  } else {
    const persona = getPersona(config.persona);
    if (persona) {
      parts.push(`\n## Persona: ${persona.name}\n${persona.basePrompt}`);
      
      // Add persona modifiers
      if (persona.modifiers) {
        const modifierText = persona.modifiers
          .map(m => `${m.type}: ${m.value}`)
          .join("\n");
        parts.push(`\n## Style Guidelines\n${modifierText}`);
      }
    }
  }
  
  // 3. Language instruction
  parts.push(getLanguageInstruction(language));
  
  // 4. Format instruction
  parts.push(getFormatInstruction(formatStyle));
  
  // 5. Get available tools and their instructions
  const availableTools = await getAvailableTools(config.toolSettings);
  metadata.enabledTools = availableTools.map(t => t.id);
  
  if (availableTools.length > 0) {
    // Get persona to check for preferred tools
    const persona = getPersona(config.persona);
    const preferredTools = persona?.preferredTools || [];
    
    // Build tool instructions with emphasis on preferred tools
    const toolInstructions = buildToolInstructionsWithPreferences(
      availableTools,
      preferredTools
    );
    parts.push(toolInstructions);
  }
  
  // 6. Context from providers (CAG, images, etc.)
  if (config.context) {
    // Add CAG context to customData
    const contextParams = {
      ...config.context,
      customData: {
        ...config.context.customData,
        cagContext: config.cagContext,
      },
    };
    
    const contextText = await buildContext(contextParams);
    if (contextText) {
      parts.push(contextText);
      metadata.contextProviders.push("cag", "images", "documents");
    }
  }
  
  return {
    systemPrompt: parts.join("\n"),
    availableTools: availableTools.map(t => t.definition),
    metadata,
  };
}

/**
 * Build tool instructions with emphasis on preferred tools
 */
function buildToolInstructionsWithPreferences(
  tools: ToolModule[],
  preferredTools: string[]
): string {
  if (tools.length === 0) return "";
  
  const preferred = tools.filter(t => preferredTools.includes(t.id));
  const other = tools.filter(t => !preferredTools.includes(t.id));
  
  let instructions = "\n\n## Available Tools";
  
  if (preferred.length > 0) {
    instructions += "\n\n**Primary tools (prefer these for this persona):**";
    for (const tool of preferred) {
      instructions += `\n- ${tool.definition.function.name}: ${tool.promptInstructions}`;
    }
  }
  
  if (other.length > 0) {
    if (preferred.length > 0) {
      instructions += "\n\n**Additional tools:**";
    }
    for (const tool of other) {
      instructions += `\n- ${tool.definition.function.name}: ${tool.promptInstructions}`;
    }
  }
  
  return instructions;
}

/**
 * Quick helper to get tool definitions for API call
 */
export function getToolDefinitions(toolIds: string[]): ToolModule["definition"][] {
  return toolIds
    .map(id => getTool(id))
    .filter((t): t is ToolModule => t !== undefined)
    .map(t => t.definition);
}

// Re-export for convenience
export { registerTool, getTool, getAllTools } from "./tool-registry.ts";
export { registerPersona, getPersona, getAllPersonas } from "./persona-registry.ts";
export { registerContextProvider } from "./context-providers.ts";
export * from "./types.ts";
