/**
 * Context Providers
 * 
 * Modular system for injecting context into the system prompt.
 * Each provider handles a specific type of context (CAG, images, etc.)
 */

import type { ContextProvider, ContextParams } from "./types.ts";

const providers: Map<string, ContextProvider> = new Map();

/**
 * Register a context provider
 */
export function registerContextProvider(provider: ContextProvider): void {
  providers.set(provider.id, provider);
}

/**
 * Get all registered providers sorted by priority
 */
export function getAllProviders(): ContextProvider[] {
  return Array.from(providers.values()).sort((a, b) => a.priority - b.priority);
}

/**
 * Build context from all providers
 */
export async function buildContext(params: ContextParams): Promise<string> {
  const sortedProviders = getAllProviders();
  const contextParts: string[] = [];
  
  for (const provider of sortedProviders) {
    const context = await provider.getContext(params);
    if (context) {
      contextParts.push(context);
    }
  }
  
  return contextParts.join("\n\n");
}

// ============================================
// BUILT-IN CONTEXT PROVIDERS
// ============================================

/**
 * CAG (Context-Augmented Generation) Provider
 * Injects content from attached notes/files
 */
registerContextProvider({
  id: "cag",
  priority: 10,
  getContext: async (params) => {
    if (!params.customData?.cagContext) return null;
    
    const cagContext = params.customData.cagContext as string;
    if (!cagContext.trim()) return null;
    
    return `## Reference Context\nThe following information has been attached for reference:\n\n${cagContext}`;
  },
});

/**
 * Image Attachments Provider
 * Notifies AI about attached images
 */
registerContextProvider({
  id: "images",
  priority: 20,
  getContext: async (params) => {
    const imageAttachments = params.attachments?.filter(
      a => a.type.startsWith("image/")
    );
    
    if (!imageAttachments || imageAttachments.length === 0) return null;
    
    const imageNames = imageAttachments.map(f => f.name).join(", ");
    return `## Attached Images\nThe user has attached ${imageAttachments.length} image(s): ${imageNames}.\nUse the analyze_images tool ONLY if the user explicitly asks to analyze or describe these images.`;
  },
});

/**
 * Document Attachments Provider
 * Notifies AI about attached documents
 */
registerContextProvider({
  id: "documents",
  priority: 25,
  getContext: async (params) => {
    const docAttachments = params.attachments?.filter(
      a => !a.type.startsWith("image/") && a.content
    );
    
    if (!docAttachments || docAttachments.length === 0) return null;
    
    const docSummary = docAttachments
      .map(d => `- ${d.name}: ${d.content?.slice(0, 200)}...`)
      .join("\n");
    
    return `## Attached Documents\n${docSummary}`;
  },
});

/**
 * Conversation Context Provider
 * Adds information about the conversation type
 */
registerContextProvider({
  id: "conversation",
  priority: 5,
  getContext: async (params) => {
    if (params.roomId) {
      return "## Context\nYou are in a collaborative room where multiple users can participate. Address users by name when responding to specific questions.";
    }
    if (params.conversationId) {
      return "## Context\nThis is a direct conversation. Focus on the user's needs and maintain continuity with previous messages.";
    }
    return null;
  },
});
