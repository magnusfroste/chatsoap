/**
 * Modular Prompt System Types
 * 
 * This defines the plugin architecture for ChatSoap's AI system.
 * Third-party modules (Chrome extensions, plugins) can register
 * their own tools, personas, and context providers.
 */

export interface ToolModule {
  /** Unique tool identifier */
  id: string;
  
  /** OpenAI-compatible function definition */
  definition: {
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  };
  
  /** Instructions injected into system prompt when tool is enabled */
  promptInstructions: string;
  
  /** Optional: Check if tool should be available */
  isAvailable?: () => boolean | Promise<boolean>;
  
  /** Tool execution handler */
  execute: (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;
}

export interface ToolContext {
  userId?: string;
  conversationId?: string;
  roomId?: string;
  supabase: unknown; // Supabase client
  env: Record<string, string | undefined>;
}

export interface ToolResult {
  success: boolean;
  content?: string;
  data?: Record<string, unknown>;
  error?: string;
}

export interface PersonaModule {
  /** Unique persona identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Short description */
  description: string;
  
  /** Icon name (lucide) */
  icon: string;
  
  /** Gradient class for UI */
  gradient: string;
  
  /** Base system prompt for this persona */
  basePrompt: string;
  
  /** Tools this persona prefers (will be emphasized in prompt) */
  preferredTools?: string[];
  
  /** Additional behavior modifiers */
  modifiers?: PersonaModifier[];
}

export interface PersonaModifier {
  type: "tone" | "format" | "focus" | "language";
  value: string;
}

export interface ContextProvider {
  /** Unique provider identifier */
  id: string;
  
  /** Priority for ordering (lower = earlier in prompt) */
  priority: number;
  
  /** Generate context to append to system prompt */
  getContext: (params: ContextParams) => Promise<string | null>;
}

export interface ContextParams {
  conversationId?: string;
  roomId?: string;
  userId?: string;
  attachments?: AttachmentInfo[];
  customData?: Record<string, unknown>;
}

export interface AttachmentInfo {
  name: string;
  type: string;
  url?: string;
  content?: string;
}

export interface PromptBuildResult {
  systemPrompt: string;
  availableTools: ToolModule["definition"][];
  metadata: {
    persona: string;
    enabledTools: string[];
    contextProviders: string[];
  };
}

export interface PromptBuilderConfig {
  /** Base persona ID or "custom" */
  persona: string;
  
  /** Custom system prompt (overrides persona) */
  customSystemPrompt?: string;
  
  /** Tool settings (which tools are enabled) */
  toolSettings: Record<string, boolean>;
  
  /** Additional context */
  context?: ContextParams;
  
  /** CAG context string */
  cagContext?: string;
}
