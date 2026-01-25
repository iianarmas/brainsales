# BrainSales - HIM Cold Call Flow

An interactive sales call assistant. Guides sales reps through cold calls with dynamic scripts, objection handling, real-time call tracking, and admin monitoring.

## Features

### Call Management

- **Guided Call Flow** - Node-based conversation navigation with scripts, key points, and context
- **Topic Navigation** - Jump to any part of the call (Opening, Discovery, EHR, DMS, Competitors, Pitch, Close, End)
- **Objection Hotbar** - Quick access to common objection handlers with keyboard shortcuts (0-8)
- **Breadcrumb Navigation** - Click any previous conversation node to rewind chronologically
- **Auto-Detection** - Automatically tracks EHR, DMS, competitors, pain points, and objections as you navigate
- **Meeting Details** - Copy-ready subject line, meeting body, and Zoom link when meeting is set
- **Call Summary** - One-click copy of call details for CRM entry

### User Experience

- **Search** - Find any script or topic quickly (Ctrl/Cmd + K)
- **Quick Reference** - Collapsible panel with product info and competitive intel
- **Resizable Panels** - Adjust left panel and quick reference widths
- **Keyboard Shortcuts** - Navigate efficiently with number keys and backspace

### Admin Features

- **Admin Dashboard** - Real-time monitoring of online users with presence tracking
- **Invite Code Management** - Admins can update the signup invite code
- **User Profiles** - Shows first and last names throughout the interface

### Authentication

- **Secure Login** - Supabase authentication with Row Level Security (RLS)
- **Invite-Only Signup** - New users require an admin-managed invite code
- **User Presence** - Real-time tracking with 30-second heartbeat and visibility detection

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account and project

### Environment Setup

Create a `.env.local` file in the root directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Database Setup

1. Run the SQL script in [database-setup.sql](database-setup.sql) in your Supabase SQL Editor to create:
   - `user_presence` table with RLS policies
   - `profiles` table (for future profile features)
   - `admins` table for admin access control
   - `settings` table for invite code management

2. Create your first admin user manually in Supabase:
   ```sql
   INSERT INTO admins (user_id) VALUES ('your-user-id-from-auth-users');
   INSERT INTO settings (key, value) VALUES ('invite_code', 'YOUR-INVITE-CODE');
   ```

### Installation

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

Sign up using the invite code you configured in the database.

## Keyboard Shortcuts

| Key            | Action                             |
| -------------- | ---------------------------------- |
| `0-8`          | Jump to objection handler          |
| `Backspace`    | Return to main flow from objection |
| `Ctrl/Cmd + K` | Open search                        |
| `Escape`       | Close search/modals                |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/          # Login endpoint
│   │   │   └── signup-with-code/ # Invite code signup
│   │   └── admin/
│   │       ├── online-users/   # Real-time presence tracking
│   │       └── settings/       # Admin settings management
│   ├── icon.png                # Custom BrainSales favicon
│   └── layout.tsx              # Root layout with AuthProvider
├── components/
│   ├── CallScreen.tsx          # Main layout with header and panels
│   ├── NodeDisplay.tsx         # Script display with key points
│   ├── TopicNav.tsx            # Topic navigation tabs
│   ├── ObjectionHotbar.tsx     # Objection quick access (0-8 keys)
│   ├── Breadcrumb.tsx          # Chronological path navigation
│   ├── MetadataDisplay.tsx     # Auto-detected EHR/DMS/competitors
│   ├── LeftPanel.tsx           # Breadcrumb, metadata, notes
│   ├── QuickReference.tsx      # Product reference panel
│   ├── MeetingDetails.tsx      # Meeting copy buttons
│   ├── AdminDashboard.tsx      # Admin panel with online users
│   ├── LoginPage.tsx           # Login UI
│   └── SignupPage.tsx          # Signup UI with invite code
├── context/
│   └── AuthContext.tsx         # Supabase auth provider
├── hooks/
│   └── usePresence.ts          # User presence tracking hook
├── data/
│   ├── callFlow.ts             # All call scripts and nodes
│   └── topicGroups.ts          # Topic navigation groups
├── store/
│   └── callStore.ts            # Zustand state (conversation, metadata)
└── lib/
    ├── supabaseClient.ts       # Client-side Supabase
    └── supabaseServer.ts       # Server-side Supabase (admin)
```

## Call Context Auto-Detection

BrainSales automatically detects and tracks call context as you navigate:

- **EHR Detection** - Recognizes Epic, Cerner, Meditech, Allscripts, eClinicalWorks
- **DMS Detection** - Tracks Epic Gallery, OnBase, Hyland, Athena, NextGen
- **Intelligent Mapping** - Gallery selection automatically sets EHR to Epic
- **Path-Based Logic** - "EHR only" paths register "None" for DMS, and vice versa
- **Competitor Tracking** - Auto-adds competitors as you discuss them
- **Pain Points** - Tracks mentioned pain points throughout the conversation

All metadata is displayed in the left panel and included in the call summary.

## Admin Dashboard

Admins have access to a dashboard with:

- **Real-Time Presence** - See who's currently online (updated every 30 seconds)
- **User Details** - Displays first and last names from user profiles
- **Invite Code Management** - Change the signup invite code on the fly
- **Heartbeat Monitoring** - Tracks users as online if seen within last 2 minutes

Access the admin dashboard by clicking the admin button in the CallScreen header (only visible to admin users).

## Editing Scripts

All call scripts are in [src/data/callFlow.ts](src/data/callFlow.ts). Each node has:

```typescript
{
  id: "node_id",
  title: "Node Title",
  type: "opening" | "discovery" | "pitch" | "objection" | "close" | "success" | "end",
  script: "The actual script to say...",
  context?: "Background info for the rep",
  keyPoints?: ["Point 1", "Point 2"],
  listenFor?: ["Buying signals", "Pain indicators"],
  warnings?: ["Things to avoid"],
  responses: [
    { label: "Prospect says X", nextNode: "next_node_id", note?: "Optional note" }
  ],
  metadata?: {
    competitorInfo?: "Intel about competitors"
  }
}
```

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript** - Type safety throughout
- **Supabase** - Authentication, database, and storage
- **Tailwind CSS** - Utility-first styling
- **Zustand** - Lightweight state management
- **Lucide React** - Icon library

## Build

```bash
npm run build
npm start
```

## Troubleshooting

### "No users currently online" in Admin Dashboard

If the admin dashboard shows no users even when people are logged in, the `user_presence` table may be missing the `updated_at` column. Run the SQL script in [fix-user-presence.sql](fix-user-presence.sql) to fix:

```sql
-- Drop the broken trigger
DROP TRIGGER IF EXISTS update_user_presence_updated_at_trigger ON user_presence;

-- Add missing column
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Recreate trigger
CREATE OR REPLACE FUNCTION update_user_presence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_presence_updated_at_trigger
  BEFORE UPDATE ON user_presence
  FOR EACH ROW
  EXECUTE FUNCTION update_user_presence_updated_at();
```

### Authentication Issues

- Ensure all environment variables are set correctly in `.env.local`
- Verify RLS policies are enabled on all tables
- Check that the invite code in the `settings` table matches what you're using

### Presence Tracking Not Working

- Check browser console for errors
- Verify the `user_presence` table exists and has correct columns
- Ensure RLS policies allow users to insert/update their own presence

## Contributing

To add new call flow nodes:

1. Edit [src/data/callFlow.ts](src/data/callFlow.ts)
2. Add your node with appropriate type, script, and responses
3. Update topic groups in [src/data/topicGroups.ts](src/data/topicGroups.ts) if needed
4. Test the navigation flow end-to-end

## License

Proprietary - Chris Armas
