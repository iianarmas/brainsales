# BrainSales - HIM Cold Call Flow

An interactive sales call assistant for 314e's Dexit product. Guides sales reps through cold calls with dynamic scripts, objection handling, and call tracking.

## Features

- **Guided Call Flow** - Node-based conversation navigation with scripts, key points, and context
- **Topic Navigation** - Jump to any part of the call (Opening, Discovery, EHR, DMS, Competitors, Pitch, Close, End)
- **Objection Hotbar** - Quick access to common objection handlers with keyboard shortcuts (0-8)
- **Call Tracking** - Automatically tracks EHR, DMS, competitors, pain points, and objections
- **Meeting Details** - Copy-ready subject line, meeting body, and Zoom link when meeting is set
- **Search** - Find any script or topic quickly (Ctrl/Cmd + K)
- **Quick Reference** - Collapsible panel with product info and competitive intel
- **Resizable Panels** - Adjust left panel and quick reference widths
- **Call Summary** - One-click copy of call details for CRM entry

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `0-8` | Jump to objection handler |
| `Ctrl/Cmd + K` | Open search |
| `Escape` | Close search/modals |

## Project Structure

```
src/
├── app/                    # Next.js app router
├── components/
│   ├── CallScreen.tsx      # Main layout
│   ├── NodeDisplay.tsx     # Script display
│   ├── TopicNav.tsx        # Topic navigation tabs
│   ├── ObjectionHotbar.tsx # Objection quick access
│   ├── LeftPanel.tsx       # Breadcrumb, metadata, notes
│   ├── QuickReference.tsx  # Product reference panel
│   └── MeetingDetails.tsx  # Meeting copy buttons
├── data/
│   ├── callFlow.ts         # All call scripts and nodes
│   └── topicGroups.ts      # Topic navigation groups
└── store/
    └── callStore.ts        # Zustand state management
```

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

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Zustand (state management)
- Lucide React (icons)

## Build

```bash
npm run build
npm start
```
