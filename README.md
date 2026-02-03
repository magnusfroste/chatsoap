# ChatSoap 💬

A modern chat application for real-time messaging and communication. Perfect for teams, communities, or personal use.

## Features

- **Real-Time Messaging**: Instant message delivery
- **User Authentication**: Secure login with Supabase Auth
- **Message History**: Persistent conversation history
- **Responsive Design**: Works on desktop and mobile
- **Modern UI**: Clean and intuitive interface

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account (for self-hosting)

### Installation

```bash
npm install
```

### Run Locally

```bash
# Set your Supabase credentials in .env.local
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

npm run dev
```

### Self-Hosted Setup

If you want to self-host this application, you'll need:

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project (free tier available - 2 projects!)
   - Get your project URL and anon key

2. **Set Environment Variables**
   ```bash
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run Database Migrations**
   ```bash
   # Navigate to your project directory
   cd /path/to/chatsoap

   # Run all migrations
   npx supabase db push
   ```

   Or manually run migrations:
   ```bash
   npx supabase db reset
   ```

4. **Run the Application**
   ```bash
   npm run dev
   ```

### Build for Production

```bash
npm run build
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Supabase** - Backend & Auth
- **shadcn/ui** - Components
- **Tailwind CSS** - Styling

## License

MIT
