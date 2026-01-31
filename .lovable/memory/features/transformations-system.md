# Memory: features/transformations-system
Updated: 2026-01-31

## Overview

Transformations are reusable AI-powered "recipes" that process Notes content with one click. They provide a unified system for AI text operations across the workspace.

## Built-in Transformations

| Name | Icon | Prompt Purpose |
|------|------|----------------|
| Summarize | FileText | Condense content to key points |
| Extract Action Items | CheckSquare | Pull out tasks and todos as checklist |
| Key Points | List | Bullet-point format of main ideas |
| Generate Q&A | HelpCircle | Create study questions from content |
| Translate | Languages | Convert to specified target language |

## Architecture

- **Database**: `transformations` table with `is_default` flag for built-ins
- **Edge Function**: `transform-content` streams AI responses using `{{content}}` placeholder substitution
- **Hook**: `useTransformations` provides CRUD + execution with AbortController support
- **UI**: `TransformationsMenu` dropdown, `TransformationQuickAction` hover button

## Integration Points

1. **FileManagerApp**: Sparkle icon on note hover → runs transformation → creates new Note
2. **NoteEditor**: TransformationsMenu replaces hardcoded AI buttons
3. **Future**: Settings page for managing custom transformations

## Key Files

- `supabase/functions/transform-content/index.ts`
- `src/hooks/useTransformations.ts`
- `src/components/TransformationsMenu.tsx`
- `src/components/TransformationQuickAction.tsx`
- `src/components/TransformationDialog.tsx`

## Custom Transformations (Future)

Users can create custom prompts with:
- Name, description, icon selection
- Prompt template using `{{content}}` placeholder
- Stored in `transformations` table with `is_default = false`
