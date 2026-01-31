
# Implementation Plan: Transformations

## Overview

Transformations are reusable AI-powered "recipes" that can be run on Notes and Files with one click. Think of them as custom AI commands that process content in specific ways - similar to what we already have in NoteEditor (Summarize, Enhance, Translate) but extensible, user-customizable, and applicable across the entire workspace.

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRANSFORMATIONS SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐    ┌──────────────────┐    ┌─────────────────┐   │
│  │  Built-in        │    │  Custom (DB)     │    │  Output         │   │
│  │  Transformations │    │  Transformations │    │  Handler        │   │
│  ├──────────────────┤    ├──────────────────┤    ├─────────────────┤   │
│  │ - Summarize      │    │ - User-created   │    │ - Create Note   │   │
│  │ - Extract Tasks  │    │ - Icon + Color   │    │ - Replace       │   │
│  │ - Translate      │    │ - Custom Prompt  │    │ - Copy          │   │
│  │ - Key Points     │    │ - Editable       │    │                 │   │
│  │ - Q&A Generator  │    │ - Deletable      │    │                 │   │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬────────┘   │
│           │                       │                       │            │
│           └───────────────────────┴───────────────────────┘            │
│                                   │                                     │
│                    ┌──────────────▼──────────────┐                     │
│                    │   transform-content         │                     │
│                    │   (Edge Function)           │                     │
│                    └──────────────┬──────────────┘                     │
│                                   │                                     │
│           ┌───────────────────────┼───────────────────────┐            │
│           ▼                       ▼                       ▼            │
│  ┌────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │   NoteEditor   │    │  FileManager    │    │  Quick Actions  │     │
│  │   (Note AI)    │    │  (File context) │    │  Menu           │     │
│  └────────────────┘    └─────────────────┘    └─────────────────┘     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## What Gets Built

### 1. Built-in Transformations (Pre-installed)

| Name | Icon | Purpose |
|------|------|---------|
| Summarize | FileText | Condense content to key points |
| Extract Action Items | CheckSquare | Pull out tasks and todos |
| Translate | Languages | Convert to another language |
| Key Points | List | Bullet-point format of main ideas |
| Generate Q&A | HelpCircle | Create study questions from content |

### 2. Custom Transformations

Users create their own via dialog:
- Name (required)
- Description (optional)
- Prompt template (required) - supports `{{content}}` placeholder
- Icon selection (6 options)
- Color gradient

### 3. UI Integration Points

**A. NoteEditor Quick Actions**
- Replace current hardcoded Summarize/Enhance/Translate buttons with dynamic Transformations menu
- Dropdown with all available transformations
- Result appears in preview pane, user can Apply or Discard

**B. FileManagerApp Context Menu**
- When hovering a file/note row, show sparkle icon
- Click opens Transformations dropdown
- Result creates a new Note (since files are read-only)

**C. Manage Transformations Dialog**
- Accessed from Settings or FileManager header
- List all transformations (built-in marked, custom editable)
- Create/Edit/Delete custom transformations

## Technical Details

### Database

The `transformations` table already exists with this schema:

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| user_id | uuid | Owner (null for built-in) |
| name | text | Display name |
| description | text | Optional description |
| prompt | text | The AI prompt template |
| icon | text | lucide icon name |
| is_default | boolean | True for built-in |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Last update |

**Migration needed**: Add `is_default` column for built-in transformations

### Edge Function: transform-content

New edge function that:
1. Receives: `{ transformationId, content, targetLanguage? }`
2. Loads transformation prompt from DB (or uses built-in)
3. Replaces `{{content}}` placeholder with actual content
4. Streams response back
5. Handles rate limits and errors

### Frontend Hook: useTransformations

```typescript
interface Transformation {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  icon: string;
  isDefault: boolean;
}

const { 
  transformations,     // All available (built-in + custom)
  isLoading,
  createTransformation,
  updateTransformation,
  deleteTransformation,
  runTransformation,   // Execute on content
  isProcessing,
  cancel,
} = useTransformations(userId);
```

### Components

| Component | Purpose |
|-----------|---------|
| TransformationsMenu | Dropdown showing all transformations |
| TransformationDialog | Create/Edit custom transformation |
| ManageTransformationsCard | Settings view for managing list |
| TransformationQuickAction | Hover button for FileManager rows |

## Implementation Steps

### Phase 1: Backend Foundation ✅ COMPLETE
1. ✅ Created migration to seed built-in transformations (Summarize, Extract Action Items, Key Points, Generate Q&A, Translate)
2. ✅ Created `transform-content` edge function with streaming support
3. ✅ Created `useTransformations` hook for CRUD + execution

### Phase 2: UI Components ✅ COMPLETE
1. ✅ Created TransformationsMenu dropdown component
2. ✅ Created TransformationDialog for create/edit
3. ✅ Created TransformationQuickAction hover button

### Phase 3: Integration ✅ COMPLETE
1. ✅ Added TransformationsMenu quick action to FileManagerApp (list and grid views)
2. ✅ Transformation results create new Notes automatically
3. ✅ Loading state during processing

### Phase 4: Management UI (FUTURE)
1. Create ManageTransformationsCard to Settings/Profile
2. Add ability to create custom transformations via dialog

## User Flow Example

1. User uploads a PDF to the chat
2. Opens FileManager (Files panel in canvas)
3. Hovers over the PDF row, clicks sparkle icon
4. Dropdown shows: Summarize, Extract Tasks, Key Points, etc.
5. Clicks "Extract Action Items"
6. Loading indicator while AI processes
7. New Note is created: "Action Items from document.pdf"
8. Note opens in editor with extracted tasks
9. User can edit, save, or send to chat

## Files to Create/Modify

### New Files
- `supabase/functions/transform-content/index.ts` - Edge function
- `src/hooks/useTransformations.ts` - State management hook
- `src/components/TransformationsMenu.tsx` - Dropdown component
- `src/components/TransformationDialog.tsx` - Create/Edit dialog
- `src/components/TransformationQuickAction.tsx` - Hover action button

### Modified Files
- `src/components/NoteEditor.tsx` - Replace AI buttons with menu
- `src/components/canvas/FileManagerApp.tsx` - Add quick action
- `src/pages/Profile.tsx` - Add management section (optional)

### Database Migration
- Add `is_default` column
- Seed built-in transformations

## Built-in Transformation Prompts

**Summarize**
```
Summarize the following content concisely, preserving key information and main points. Respond in the same language as the input.

{{content}}
```

**Extract Action Items**
```
Extract all action items, tasks, and todos from the following content. Format as a checklist. If no explicit tasks, identify implied next steps.

{{content}}
```

**Key Points**
```
Extract the main points from this content as clear, concise bullet points. Focus on the most important information.

{{content}}
```

**Generate Q&A**
```
Create 5-10 study questions with answers based on this content. Make questions progressively more challenging.

{{content}}
```

**Translate** (uses targetLanguage parameter)
```
Translate the following content to {{targetLanguage}}. Preserve formatting and meaning.

{{content}}
```
