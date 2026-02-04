# BrainSales - AI-Powered Sales Assistant

An advanced, interactive sales enablement platform. Guides sales reps through high-stakes cold calls with dynamic, product-aware scripts, real-time objection handling, and comprehensive knowledge management.

## 🚀 Key Features

### 🛠️ Visual Script Editor (React Flow)
A powerful, node-based workspace for designing complex call flows:
- **Drag & Drop Interface** - Intuitive canvas powered by `@xyflow/react`.
- **Intelligent Search** - Cycle through multiple matches in titles and script text with visual highlighting.
- **Heatmap Visualization** - See real-world script usage at a glance with intensity overlays.
- **Flow Validation** - Automated checks for dead ends, orphaned nodes, and broken connections.
- **Snapshot History** - Product-specific version control to save and restore script iterations.
- **Auto-Layout** - One-click organization of complex script webs.

### 📦 Product System & Knowledge Base
The platform is fully product-centric, allowing for isolated management of different sales lines:
- **Product Switcher** - Seamlessly alternate between different product sets.
- **Knowledge Base (KB)** - Rich-text updates and documentation targeted at specific products.
- **Quick Reference Editor** - Manage differentiators, competitive intel, and pro-tips with a drag-and-drop editor.
- **Team Updates** - Feed-style updates for specific teams and product groups.

### 📞 Call Management
- **Guided Call Flow** - Dynamic navigation with contextual scripts and key points.
- **Objection Hotbar** - Instant access to proven handlers with keyboard shortcuts (0-8).
- **Auto-Detection** - Intelligent tracking of EHR, DMS, competitors, and pain points during the call.
- **Variable Injection** - Personalize scripts with `${first_name}`, `${phone}`, and role-based variables.
- **Meeting Details** - Copy-ready, personalized calendar invites with dynamic Zoom links.

### 🔐 Admin & Security
- **Multi-Tab Dashboard** - Manage Online Users, Product Creation, Script Editing, and User Roles.
- **Presence Tracking** - Real-time monitoring of active sales reps.
- **Role-Based Access** - Secure Supabase RLS policies ensuring data isolation between products.
- **Invite-Only Signup** - Controlled onboarding via admin-managed invite codes.

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- Supabase account and project

### Environment Setup
Create a `.env.local` file:
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Database & Migrations
1. Run the base setup in [database-setup.sql](database-setup.sql).
2. Follow the migration sequence in `supabase/migrations/` for product-awareness and script versioning:
   - `006_add_products_schema.sql`
   - `008_enforce_product_constraints.sql`
   - `016_add_product_id_to_snapshots.sql`

### Installation
```bash
npm install
npm run dev
```

## ⌨️ Keyboard Shortcuts

| Key            | Action                             |
| -------------- | ---------------------------------- |
| `0-8`          | Jump to objection handler          |
| `Backspace`    | Return to main flow from objection |
| `Ctrl/Cmd + K` | Open global search                 |
| `Ctrl/Cmd + Z` | Undo action in Script Editor       |
| `Ctrl/Cmd + Y` | Redo action in Script Editor       |
| `Escape`       | Close search/modals                |

## 📁 Project Structure

```
src/
├── app/
│   ├── api/            # Product, Script, and Auth API routes
│   └── admin/          # Admin dashboard and Script Editor page
├── components/
│   ├── ScriptEditor/   # Visual Node-based editor components
│   ├── CallScreen/     # Live call interface
│   └── KnowledgeBase/  # KB updates and Reference panels
├── context/            # Auth, Product, and Team context providers
├── hooks/              # Presence, Admin, and Data-fetching hooks
└── data/               # Static models and config
```

## 📝 License
Proprietary - Chris Armas
