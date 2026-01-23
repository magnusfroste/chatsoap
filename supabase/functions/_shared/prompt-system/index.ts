/**
 * ChatSoap Modular Prompt System
 * 
 * A plugin-style architecture for building AI system prompts.
 * 
 * ## Architecture
 * 
 * 1. **Base Prompt** - Core behaviors for all AI interactions
 * 2. **Persona Modules** - Specialized personalities (Code, Writer, etc.)
 * 3. **Tool Modules** - Self-documenting tools with their own instructions
 * 4. **Context Providers** - Inject dynamic context (CAG, images, etc.)
 * 
 * ## Plugin Development
 * 
 * Third-party developers can extend the system by registering:
 * 
 * ```typescript
 * import { registerTool, registerPersona, registerContextProvider } from "./prompt-system";
 * 
 * // Add a custom tool
 * registerTool({
 *   id: "my_custom_tool",
 *   definition: { ... },
 *   promptInstructions: "Use when...",
 *   execute: async (args, context) => { ... },
 * });
 * 
 * // Add a custom persona
 * registerPersona({
 *   id: "my_persona",
 *   name: "My Custom Persona",
 *   basePrompt: "You are...",
 *   preferredTools: ["my_custom_tool"],
 * });
 * 
 * // Add a context provider
 * registerContextProvider({
 *   id: "my_context",
 *   priority: 30,
 *   getContext: async (params) => "Additional context...",
 * });
 * ```
 * 
 * ## Usage
 * 
 * ```typescript
 * import { buildSystemPrompt } from "./prompt-system";
 * 
 * const result = await buildSystemPrompt({
 *   persona: "code",
 *   toolSettings: { web_search: true, send_code_to_sandbox: true },
 *   cagContext: "Reference: ...",
 *   context: { conversationId: "..." },
 * });
 * 
 * // Use in LLM call
 * const messages = [
 *   { role: "system", content: result.systemPrompt },
 *   ...conversationMessages,
 * ];
 * 
 * // Pass available tools
 * const tools = result.availableTools;
 * ```
 */

// Main builder
export { buildSystemPrompt, getToolDefinitions } from "./prompt-builder.ts";

// Registries for plugin development
export { registerTool, getTool, getAllTools } from "./tool-registry.ts";
export { registerPersona, getPersona, getAllPersonas } from "./persona-registry.ts";
export { registerContextProvider, getAllProviders } from "./context-providers.ts";

// Base prompt utilities
export { BASE_PROMPT, getLanguageInstruction, getFormatInstruction } from "./base-prompt.ts";

// Types
export type {
  ToolModule,
  ToolContext,
  ToolResult,
  PersonaModule,
  PersonaModifier,
  ContextProvider,
  ContextParams,
  AttachmentInfo,
  PromptBuildResult,
  PromptBuilderConfig,
} from "./types.ts";
