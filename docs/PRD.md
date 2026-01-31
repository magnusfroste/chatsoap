# Product Requirements Document (PRD)

## ChatSoap - AI-Powered Collaborative Workspace

### Vision

A WhatsApp-inspired messaging platform with integrated AI assistants, collaborative tools, and a powerful workspace canvas for productivity.

---

## Core Features

### 1. Conversations

#### 1.1 Direct Messages
- 1-on-1 chats between users
- Real-time message sync via Supabase Realtime
- Message reactions (emoji)
- Reply-to threading
- Read receipts

#### 1.2 Group Chats
- Multi-user conversations
- Invite links for easy joining
- Member management

#### 1.3 AI Assistant Chats
- Dedicated AI conversations with persona selection
- Context-Augmented Generation (CAG) using notes and files
- Multiple AI personas (General, Coder, Writer, etc.)
- Custom persona creation

### 2. Voice & Video Calling

- WebRTC-based 1-on-1 calls
- Audio and video support
- Incoming call notifications with ringtone
- Audio level indicators
- Call status sync via Supabase

### 3. Workspace Canvas

A modular panel system with mini-applications:

#### 3.1 Files Manager
- View all conversation attachments
- Unified view of files + notes
- Drag-and-drop upload
- File soft-deletion
- CAG context selection (park files for AI context)

#### 3.2 Notes
- Per-conversation note storage
- Markdown support
- AI-powered editing (via Transformations)
- Export to Markdown/PDF

#### 3.3 Whiteboard
- Collaborative drawing canvas
- Real-time sync via Supabase
- Shape tools (rectangle, circle, sticky notes)

#### 3.4 Slides
- AI-assisted presentation creation
- Multiple themes (dark, light, minimal, bold)
- Real-time collaborative editing
- Presentation mode

#### 3.5 Code Sandbox
- JavaScript/TypeScript execution
- Real-time collaborative editing
- Console output display

#### 3.6 Spreadsheet
- Collaborative spreadsheet with formulas
- Cell-level real-time sync

#### 3.7 Mini Browser
- Embedded web browsing
- AI can navigate to URLs

### 4. Transformations System

Reusable AI "recipes" for content processing:

#### 4.1 Built-in Transformations
| Name | Purpose |
|------|---------|
| Summarize | Condense content to key points |
| Extract Action Items | Pull out tasks as checklist |
| Key Points | Bullet-point main ideas |
| Generate Q&A | Create study questions |
| Translate | Convert to target language |

#### 4.2 How It Works
1. User hovers over a note in Files panel
2. Clicks sparkle (wand) icon
3. Selects transformation from dropdown
4. AI processes content via `transform-content` edge function
5. Result is saved as new Note in same conversation

#### 4.3 Custom Transformations (Planned)
- User-defined prompts with `{{content}}` placeholder
- Custom icons and descriptions
- Managed via Settings page

### 5. Document Processing

#### 5.1 Upload & Storage
- Images: JPEG, PNG, GIF, WebP
- Documents: PDF, DOCX, TXT
- 10MB file size limit
- Stored in Supabase Storage

#### 5.2 Document Analysis
- AI-powered document summarization
- Content extraction for CAG context

### 6. Context-Augmented Generation (CAG)

"Park" files and notes to include them in AI context:
- Toggle selection in Files panel
- Badge shows count of selected items
- AI receives content when generating responses

---

## Technical Architecture

### Frontend
- React 18 + TypeScript
- Vite build system
- Tailwind CSS + shadcn/ui
- React Router for navigation

### Backend (Lovable Cloud / Supabase)
- PostgreSQL database
- Row Level Security (RLS)
- Real-time subscriptions
- Edge Functions for AI operations
- Storage for file uploads

### AI Integration
- Lovable AI (no API key required)
- Streaming responses
- Model: gemini-2.5-flash (default)

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| conversations | Chat metadata (type, name, persona) |
| conversation_members | User membership |
| messages | Chat messages with attachments |
| notes | User notes per conversation |
| transformations | AI transformation recipes |
| profiles | User display names and avatars |
| rooms | Whiteboard/canvas room data |
| room_canvas | Whiteboard drawing data |
| room_slides | Presentation data |
| room_spreadsheets | Spreadsheet data |
| room_code_sandbox | Code sandbox state |

---

## Edge Functions

| Function | Purpose |
|----------|---------|
| room-ai-chat | AI chat with streaming |
| transform-content | Run transformations on content |
| notes-ai | AI operations on notes |
| analyze-document | Document analysis |
| parse-document | Document text extraction |

---

## Security Model

- All tables protected by RLS
- Users can only access conversations they're members of
- Notes scoped to conversation (visible to all members)
- Files shared within conversation context
- Soft-deletion preserves conversation history

---

## Future Roadmap

### Planned Features
- [ ] Custom transformations UI in Settings
- [ ] Transformation history/favorites
- [ ] Document OCR and image analysis
- [ ] AI personas with tool capabilities
- [ ] Plugin system for community extensions
- [ ] Mobile app (React Native)
- [ ] End-to-end encryption option

### Technical Debt
- Refactor large components (FileManagerApp: 1400+ lines)
- Improve error handling consistency
- Add comprehensive test coverage
