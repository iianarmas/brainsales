# BrainSales - AI-Powered Sales Enablement Platform

An advanced, interactive sales enablement platform that guides sales reps through high-stakes cold calls with dynamic, product-aware scripts, real-time objection handling, and comprehensive knowledge management.

## 🚀 Key Features

### 🏢 Multi-Tenant Organization Support
- **Organization Workspaces** - Fully isolated data environments for different companies or groups.
- **Data Scoping** - Strong multi-tenant data boundaries ensuring complete privacy for scripts, knowledge base, and team updates across organizations.
- **Role Hierarchy** - Differentiated roles including Global Super Admin, Organization Owners, Admins, and Members.

### 🛠️ Visual Script Editor (React Flow)
A powerful, node-based workspace for designing complex call flows with three distinct environments:

#### **Official Flow** (Admin Only)
- **Production Scripts** - Manage the official call flow used by all sales reps
- **Product-Specific Configuration** - Configure pain points, topic navigation, and objection shortcuts
- **Version Control** - Snapshot history with product-specific version control
- **Auto-Layout** - One-click organization of complex script webs using Dagre algorithm

#### **My Sandbox** (All Users)
- **Personal Workspace** - Experiment with custom scripts without affecting production
- **Fork from Official** - Copy official nodes to your sandbox for customization
- **Publish to Community** - Share your best scripts with the team
- **Independent Testing** - Test and iterate on scripts in isolation

#### **Community Library** (All Users)
- **Shared Scripts** - Browse and fork scripts published by other team members
- **Promote to Official** - Admins can promote community scripts to the official flow
- **Collaborative Innovation** - Crowdsource best practices from your sales team

#### **Editor Features**
- **Drag & Drop Interface** - Intuitive canvas powered by `@xyflow/react`
- **Intelligent Search** - Cycle through multiple matches in titles and script text with visual highlighting
- **Heatmap Visualization** - See real-world script usage at a glance with intensity overlays
- **Flow Validation** - Automated checks for dead ends, orphaned nodes, and broken connections
- **Undo/Redo** - Full history support with Ctrl/Cmd + Z/Y
- **Visual & Tree Views** - Toggle between node-based and hierarchical tree views
- **Node Types** - Support for standard nodes, objection handlers, discovery nodes, voicemail, and close nodes

### 📦 Product System & Knowledge Base
The platform is fully product-centric, allowing for isolated management of different sales lines:

#### **Product Management**
- **Product Switcher** - Seamlessly alternate between different product sets
- **Product Configuration** - Customize pain points, topic navigation, and objection shortcuts per product
- **Isolated Data** - Scripts, knowledge base, and analytics are product-specific
- **Role-Based Access** - Control which users can access which products

#### **Knowledge Base**
- **Rich-Text Updates** - Create and publish product-specific knowledge base articles with TipTap editor
- **Image Support** - Embed images with lightbox viewing (zoom, drag, blur background)
- **Team Updates** - Feed-style updates for specific teams and product groups
- **Acknowledgment Tracking** - Track which users have read updates and send reminders
- **Notification System** - Real-time notifications for new updates with unread badges

#### **Quick Reference Editor**
- **Differentiators** - Manage key product differentiators with drag-and-drop reordering
- **Competitive Intel** - Track competitor strengths, limitations, and your advantages
- **Key Metrics** - Display important metrics and statistics
- **Pro Tips** - Share best practices with drag-and-drop reordering

### 📞 Call Management
Dynamic, guided call interface with intelligent context tracking:

#### **Guided Call Flow**
- **Dynamic Navigation** - Follow the script flow with contextual scripts and key points
- **Topic Navigation** - Quick access to product-specific topics configured per product
- **Breadcrumb Trail** - Track your path through the call flow
- **Node Display** - View current node with title, script, key points, and next steps

#### **Objection Handling**
- **Objection Hotbar** - Instant access to proven handlers with keyboard shortcuts (0-9)
- **Dynamic Shortcuts** - Configurable per product via product configuration
- **Quick Return** - Press Backspace to return to main flow from objection

#### **Call Context**
- **Variable Injection** - Personalize scripts with `${first_name}`, `${phone}`, and role-based variables
- **Metadata Display** - Track detected EHR, DMS, competitors, and pain points
- **Quick Add Pain Points** - Easily add pain points during the call
- **Meeting Details** - Copy-ready, personalized calendar invites with dynamic Zoom links
- **Notes Field** - Take notes during the call

#### **Quick Reference Panel**
- **Resizable Sidebar** - Access differentiators, competitor intel, metrics, and tips
- **Collapsible Competitors** - Expand/collapse competitor details
- **Product-Specific** - Automatically loads data for current product

### 🔐 Admin & Security

#### **Multi-Tab Dashboard**
- **Online Users** - Real-time presence tracking of active sales reps
- **Product Management** - Create and configure products
- **Script Editor** - Full access to official flow, sandbox, and community library
- **User Management** - Manage user roles and product access

#### **Security Features**
- **Role-Based Access** - Secure Supabase RLS policies ensuring data isolation between products
- **Invite-Only Signup** - Controlled onboarding via admin-managed invite codes
- **Product Isolation** - Users only see data for products they have access to
- **Admin Controls** - Promote community scripts, manage products, and configure settings

#### **Presence Tracking**
- **Real-Time Monitoring** - See which users are currently online
- **Automatic Cleanup** - Presence records expire after inactivity
- **Product Context** - Track which product users are working with

### 📊 Analytics & Insights
- **Script Usage Heatmap** - Visualize which nodes are used most frequently
- **Flow Validation** - Identify dead ends, orphaned nodes, and broken connections
- **Version History** - Track changes to scripts over time with snapshot system

### 🎙️ Brainsales Companion (Desktop App)
A production-ready desktop application that bridges local audio capture with the web ecosystem.
- **Real-Time Audio Capture** - Securely captures microphone and system audio locally.
- **Live Transcription** - High-performance, low-latency speech-to-text powered by Deepgram's Nova-2 model.
- **WebSocket Bridge** - Feeds transcribed data to the web app (Port 4141) in real-time to power AI intents, automatic topic navigation, and call highlights.
- **Always-on-Top Mini-Player** - A compact, non-intrusive UI (320x200) with dynamic organic visualizers for microphone (Indigo) and system audio (Emerald).
- Built with Tauri (Rust), React, TypeScript, and Vite. [Explore the Repo](https://github.com/iianarmas/brainsales-companion)

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
1. Run the base setup in [database-setup.sql](database-setup.sql)
2. Follow the migration sequence in `supabase/migrations/` in order:
   - `001_knowledge_base_schema.sql` - Knowledge base foundation
   - `006_add_products_schema.sql` - Product system
   - `008_enforce_product_constraints.sql` - Product data isolation
   - `016_add_product_id_to_snapshots.sql` - Product-specific version control
   - `017_add_sandbox_community_scope.sql` - Sandbox and community features
   - `20260204_add_product_config.sql` - Product configuration system

### Installation
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## ⌨️ Keyboard Shortcuts

### Global Shortcuts
| Key            | Action                             |
| -------------- | ---------------------------------- |
| `Ctrl/Cmd + K` | Open global search                 |
| `Ctrl/Cmd + Q` | Toggle quick reference panel       |
| `Ctrl/Cmd + Shift + R` | Reset call flow            |
| `Escape`       | Close search/modals                |

### Call Screen Shortcuts
| Key            | Action                             |
| -------------- | ---------------------------------- |
| `0-8`          | Jump to objection handler          |
| `Backspace`    | Return to main flow from objection |
| `E`            | Navigate to Epic discovery         |
| `A`            | Navigate to other EHR discovery    |
| `G`            | Navigate to Gallery discovery      |
| `H`            | Navigate to OnBase discovery       |
| `O`            | Navigate to other DMS discovery    |

### Script Editor Shortcuts
| Key            | Action                             |
| -------------- | ---------------------------------- |
| `Ctrl/Cmd + Z` | Undo action                        |
| `Ctrl/Cmd + Y` | Redo action                        |
| `Delete`       | Delete selected node(s)            |

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── admin/              # Admin-only endpoints
│   │   ├── scripts/            # Script management
│   │   │   ├── sandbox/        # Sandbox CRUD operations
│   │   │   ├── community/      # Community publish/promote/fork
│   │   │   └── callflow/       # Official flow for call screen
│   │   ├── products/           # Product management
│   │   ├── kb/                 # Knowledge base endpoints
│   │   ├── analytics/          # Usage analytics
│   │   └── users/              # User management
│   ├── admin/                  # Admin dashboard pages
│   │   ├── scripts/            # Script editor page
│   │   └── knowledge-base/     # KB admin pages
│   ├── knowledge-base/         # KB public pages
│   └── scripts/                # Script editor public access
├── components/
│   ├── ScriptEditor/           # Visual node-based editor
│   │   ├── ScriptEditor.tsx    # Main editor component
│   │   ├── NodeEditPanel.tsx   # Node editing sidebar
│   │   ├── EditorTabs.tsx      # Official/Sandbox/Community tabs
│   │   ├── CommunityLibraryView.tsx # Community script browser
│   │   ├── HeatmapOverlay.tsx  # Usage heatmap visualization
│   │   ├── VersionHistoryModal.tsx # Snapshot history
│   │   ├── TreeEditor/         # Tree view components
│   │   └── nodes/              # Custom node types
│   ├── CallScreen.tsx          # Live call interface
│   ├── LeftPanel.tsx           # Call metadata and context
│   ├── MainPanel.tsx           # Current node display
│   ├── ObjectionHotbar.tsx     # Quick objection access
│   ├── TopicNav.tsx            # Product topic navigation
│   ├── QuickReference.tsx      # Reference sidebar
│   ├── KnowledgeBase/          # KB components
│   │   ├── KnowledgeBasePanel.tsx # KB modal
│   │   ├── UpdatesFeed.tsx     # Product updates feed
│   │   ├── TeamUpdatesFeed.tsx # Team updates feed
│   │   ├── NotificationDropdown.tsx # Notification bell
│   │   ├── ImageLightbox.tsx   # Image viewer
│   │   └── Admin/              # KB admin components
│   ├── AdminDashboard.tsx      # Admin multi-tab dashboard
│   ├── ProductSwitcher.tsx     # Product selection
│   ├── ProfileDropdown.tsx     # User menu
│   └── RichTextEditor.tsx      # TipTap editor
├── context/
│   ├── AuthContext.tsx         # Authentication state
│   └── ProductContext.tsx      # Current product state
├── hooks/
│   ├── useAdmin.ts             # Admin role detection
│   ├── usePresence.ts          # Real-time presence
│   ├── useCallFlow.ts          # Dynamic script loading
│   ├── useQuickReference.ts    # Quick reference data
│   └── useObjectionShortcuts.ts # Dynamic objection shortcuts
├── store/
│   └── callStore.ts            # Zustand call state management
├── types/
│   └── callFlow.ts             # TypeScript type definitions
└── data/
    └── callFlow.ts             # Static call flow data
```

## 🗄️ Database Schema

### Core Tables
- **products** - Product definitions with configuration JSON
- **user_products** - User-product access mapping
- **profiles** - User profiles with roles and Zoom links

### Script Management
- **call_nodes** - All script nodes (official, sandbox, community)
- **node_positions** - Visual editor node positions
- **flow_snapshots** - Version history with product association
- **topic_groups** - Product-specific topic navigation

### Knowledge Base
- **kb_updates** - Product knowledge base articles
- **team_updates** - Team-specific updates
- **kb_acknowledgments** - User acknowledgment tracking
- **notifications** - User notification queue

### Analytics
- **script_analytics** - Node usage tracking for heatmap

## 🎨 Technology Stack

### Frontend
- **Next.js 15** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **@xyflow/react** - Visual flow editor
- **TipTap** - Rich text editing
- **Zustand** - State management
- **Lucide React** - Icons

### Backend
- **Supabase** - PostgreSQL database, authentication, and real-time
- **Next.js API Routes** - Serverless API endpoints
- **Row Level Security** - Database-level access control

### Development
- **ESLint** - Code linting
- **tsx** - TypeScript execution for scripts

## 🔄 Recent Enhancements

- ✅ **Multi-Tenant Organization Support** - Full data isolation, organization-scoped scripts, and team updates.
- ✅ **Brainsales Companion App** - Real-time audio bridge with Deepgram Nova-2 transcription and WebSocket streaming.
- ✅ **Super Admin & Owner Roles** - Enhanced permission hierarchies for platform and organization management.
- ✅ Sandbox and Community Library system for collaborative script development
- ✅ Product configuration system for pain points and topic navigation
- ✅ Rich text editor with image support and lightbox viewing
- ✅ Drag-and-drop reordering for Quick Reference items
- ✅ Acknowledgment tracking and reminder system for KB updates
- ✅ Tree view editor as alternative to visual flow
- ✅ Heatmap visualization for script usage analytics
- ✅ Flow validation for dead ends and orphaned nodes
- ✅ Dynamic objection shortcuts configurable per product

## 📝 License
Proprietary - Chris Armas

---

**Version:** 3.12.7 
**Last Updated:** March 2026
