# ChatSoap Modular Prompt System

A plugin-style architecture for building AI system prompts that enables third-party extensions (Chrome plugins, integrations, etc.).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Prompt Builder                            │
│  Composes final system prompt from modular components       │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Base Prompt │ │  Personas   │ │    Tools    │ │  Context    │
│             │ │   Registry  │ │   Registry  │ │  Providers  │
│ Core        │ │             │ │             │ │             │
│ behaviors   │ │ - General   │ │ - web_search│ │ - CAG       │
│ for all AI  │ │ - Code      │ │ - images    │ │ - Images    │
│ interactions│ │ - Writer    │ │ - slides    │ │ - Documents │
│             │ │ - Creative  │ │ - code      │ │ - Custom    │
│             │ │ - Learning  │ │ - browser   │ │             │
│             │ │ - Custom    │ │ - Custom    │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

## Key Benefits

1. **Modularity**: Each component is self-contained with its own instructions
2. **Extensibility**: Third-party plugins can register new tools, personas, and context
3. **Scalability**: Easy to add new capabilities without modifying core code
4. **Maintainability**: Clear separation of concerns

## Quick Start

### Using the Prompt Builder

```typescript
import { buildSystemPrompt } from "./prompt-system";

const result = await buildSystemPrompt({
  persona: "code",
  toolSettings: {
    web_search: true,
    send_code_to_sandbox: true,
    analyze_images: true,
  },
  cagContext: "Reference documentation content...",
  context: {
    conversationId: "abc123",
    attachments: [{ name: "screenshot.png", type: "image/png" }],
  },
});

// result.systemPrompt - Complete system prompt
// result.availableTools - Tool definitions for LLM API
// result.metadata - Info about what was included
```

## Plugin Development Guide

### Adding a Custom Tool

Tools are self-documenting units that include both their API definition and the prompt instructions for the AI.

```typescript
import { registerTool } from "./prompt-system";

registerTool({
  id: "my_custom_tool",
  
  // OpenAI-compatible function definition
  definition: {
    type: "function",
    function: {
      name: "my_custom_tool",
      description: "Does something useful",
      parameters: {
        type: "object",
        properties: {
          input: { type: "string", description: "The input data" },
        },
        required: ["input"],
      },
    },
  },
  
  // Instructions injected into the system prompt when this tool is enabled
  promptInstructions: "Use when the user asks to do something specific. Provide clear input for best results.",
  
  // Optional: Check if tool should be available (e.g., API key present)
  isAvailable: () => !!Deno.env.get("MY_TOOL_API_KEY"),
  
  // Tool execution handler
  execute: async (args, context) => {
    // Your tool logic here
    return { success: true, content: "Result" };
  },
});
```

### Adding a Custom Persona

Personas define specialized AI behaviors with preferred tools.

```typescript
import { registerPersona } from "./prompt-system";

registerPersona({
  id: "data_analyst",
  name: "Data Analyst",
  description: "Expert in data analysis and visualization",
  icon: "BarChart",
  gradient: "from-blue-500 to-indigo-500",
  
  basePrompt: `You are an expert data analyst who helps users understand and visualize their data.

You excel at:
- Interpreting datasets and finding patterns
- Creating clear visualizations
- Explaining statistical concepts
- Writing data processing code`,
  
  // These tools will be emphasized when this persona is active
  preferredTools: ["send_code_to_sandbox", "web_search"],
  
  // Style modifiers
  modifiers: [
    { type: "format", value: "Use tables and charts when presenting data" },
    { type: "tone", value: "Precise and analytical" },
  ],
});
```

### Adding a Context Provider

Context providers inject dynamic information into the system prompt.

```typescript
import { registerContextProvider } from "./prompt-system";

registerContextProvider({
  id: "user_preferences",
  priority: 15, // Lower = earlier in prompt
  
  getContext: async (params) => {
    // Fetch user preferences from database
    const prefs = await fetchUserPreferences(params.userId);
    
    if (!prefs) return null; // Return null to skip this provider
    
    return `## User Preferences
The user prefers:
- Language: ${prefs.language}
- Detail level: ${prefs.detailLevel}
- Code style: ${prefs.codeStyle}`;
  },
});
```

## Built-in Components

### Personas

| ID | Name | Description |
|---|---|---|
| `general` | General Assistant | Versatile AI for any task |
| `code` | Code Expert | Programming specialist |
| `writer` | Writing Assistant | Creative and professional writing |
| `creative` | Creative Partner | Brainstorming and innovation |
| `learning` | Learning Mentor | Patient teaching |

### Tools

| ID | Description | Instructions |
|---|---|---|
| `analyze_images` | Vision analysis | Use when user asks to analyze images |
| `web_search` | Web search | Use for current information |
| `generate_image` | Image generation | Use when user asks to create images |
| `code_execution` | Run code | Use to execute and show results |
| `send_code_to_sandbox` | Collaborative code | Use for writing/sharing code |
| `generate_slides` | Presentations | Use for slideshows and pitch decks |
| `navigate_browser` | Browser control | Use to open websites |

### Context Providers

| ID | Priority | Description |
|---|---|---|
| `conversation` | 5 | Conversation type context |
| `cag` | 10 | Attached notes/files content |
| `images` | 20 | Attached image notifications |
| `documents` | 25 | Attached document summaries |

## Chrome Extension Integration

For Chrome extension developers, here's how to integrate with ChatSoap:

```typescript
// In your Chrome extension
async function registerExtensionTools() {
  // Call ChatSoap's plugin API
  await chatsoap.registerTool({
    id: "extension_tool",
    definition: { ... },
    promptInstructions: "...",
    execute: async (args) => {
      // Extension-specific logic
    },
  });
}

// Listen for tool invocations
chatsoap.onToolInvoke("extension_tool", async (args, respond) => {
  const result = await myExtensionFunction(args);
  respond({ success: true, content: result });
});
```

## File Structure

```
supabase/functions/_shared/prompt-system/
├── index.ts              # Main exports
├── types.ts              # TypeScript interfaces
├── base-prompt.ts        # Core AI behaviors
├── persona-registry.ts   # Persona management
├── tool-registry.ts      # Tool management
├── context-providers.ts  # Context injection
└── prompt-builder.ts     # Composition logic
```

## Best Practices

1. **Tool Instructions**: Be specific about when to use tools
2. **Persona Preferences**: Mark which tools work best with each persona
3. **Context Priority**: Use appropriate priorities (lower = more important)
4. **Error Handling**: Always return `{ success: false, error: "..." }` on failures
5. **Availability Checks**: Use `isAvailable` for tools requiring API keys
