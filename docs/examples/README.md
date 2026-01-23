# ChatSoap Plugin Examples

This directory contains example plugins demonstrating how to extend ChatSoap's AI capabilities.

## Quick Start

### 1. Creating a Custom Tool

Tools add new capabilities to the AI. See `weather-tool-plugin.ts` for a complete example.

```typescript
import { registerTool } from "../prompt-system";

registerTool({
  id: "my_tool",
  definition: {
    type: "function",
    function: {
      name: "my_tool",
      description: "What this tool does",
      parameters: {
        type: "object",
        properties: {
          input: { type: "string", description: "Input description" },
        },
        required: ["input"],
      },
    },
  },
  promptInstructions: "Use when the user asks to...",
  execute: async (args) => {
    return { success: true, content: "Result" };
  },
});
```

### 2. Creating a Custom Persona

Personas define specialized AI behaviors. See `translator-persona-plugin.ts` for a complete example.

```typescript
import { registerPersona } from "../prompt-system";

registerPersona({
  id: "my_persona",
  name: "My Persona",
  description: "What this persona specializes in",
  icon: "Sparkles",
  gradient: "from-purple-500 to-pink-500",
  basePrompt: "You are an expert in...",
  preferredTools: ["web_search"],
});
```

### 3. Creating a Context Provider

Context providers inject dynamic information into the system prompt.

```typescript
import { registerContextProvider } from "../prompt-system";

registerContextProvider({
  id: "my_context",
  priority: 50, // Lower = earlier in prompt
  getContext: async (params) => {
    // Return context string or null to skip
    return `Current time: ${new Date().toISOString()}`;
  },
});
```

## Plugin Structure

```
my-plugin/
├── index.ts          # Main entry, exports register function
├── tools/            # Custom tools
│   └── my-tool.ts
├── personas/         # Custom personas
│   └── my-persona.ts
└── README.md         # Plugin documentation
```

## Best Practices

### Tool Design
- **Be specific** in `promptInstructions` about when to use the tool
- **Validate inputs** in `execute` before processing
- **Use `isAvailable`** to check for required API keys
- **Return structured data** in `ToolResult.data` for frontend rendering

### Persona Design
- **Keep `basePrompt` focused** on the persona's specialty
- **List `preferredTools`** that enhance this persona
- **Use modifiers** to fine-tune behavior (tone, format, focus)

### Context Providers
- **Use appropriate priority** (5-10 for critical, 20-30 for supplementary)
- **Return null** when context isn't relevant
- **Keep context concise** to preserve token budget

## Examples in This Directory

| File | Type | Description |
|------|------|-------------|
| `weather-tool-plugin.ts` | Tool | Weather information lookup |
| `translator-persona-plugin.ts` | Persona | Multilingual translation expert |

## Chrome Extension Integration

For Chrome extension developers:

```typescript
// content-script.ts
window.addEventListener("chatsoap-register-plugin", (event) => {
  const { tools, personas } = event.detail;
  
  // Send to background script for registration
  chrome.runtime.sendMessage({
    type: "REGISTER_PLUGINS",
    tools,
    personas,
  });
});

// Trigger plugin registration
window.dispatchEvent(new CustomEvent("chatsoap-plugin-ready"));
```

See the main documentation at `docs/prompt-system.md` for the complete API reference.
