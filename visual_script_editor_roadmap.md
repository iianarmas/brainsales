# Visual Script Editor Roadmap & Implementation Plan

This document outlines the complete development roadmap for the BrainSales Visual Script Editor, tracking progress from initial infrastructure to advanced features.

## ✅ Phase 1: Database Setup & Migration (Completed)
**Goal:** Move from static `callFlow.ts` file to a dynamic PostgreSQL database schema.
- [x] **Database Schema Design**: Created 7 tables (`call_nodes`, `call_node_keypoints`, `call_node_responses`, etc.)
- [x] **Migration Scripts**: Built `migrate-callflow-to-db.ts` using Dagre for initial layout.
- [x] **Data Migration**: Successfully migrated 67 nodes, 286 responses, and all metadata.
- [x] **Fallback Mechanism**: Created logic to fallback to static file if DB is unreachable.

## ✅ Phase 2: Core Infrastructure (Completed)
**Goal:** Build the API layer and data access hooks.
- [x] **Public API**: `GET /api/scripts/callflow` with caching (5 min).
- [x] **Admin API**: `GET /api/admin/scripts/nodes` with secure auth checks.
- [x] **Authentication**: RLS policies and `isAdmin` server-side verification.
- [x] **Client Hooks**: `useCallFlow` hook to abstract data fetching source.

## ✅ Phase 3: Visual Editor Foundation (Completed)
**Goal:** Create the visual drag-and-drop interface.
- [x] **React Flow Integration**: Setup canvas, controls, minimap, and background.
- [x] **Custom Node Components**: Designed nice UI for nodes (ScriptNode) with color-coding by type.
- [x] **Edit Panel**: Created right sidebar for viewing node details.
- [x] **Integration**: Added "Scripts" button to main call screen header.

## ✅ Phase 4: Save & CRUD Operations (Completed)
**Goal:** Make the editor functional with read/write capabilities.
- [x] **Update API**: `PATCH /api/admin/scripts/nodes/[id]` for full node updates.
- [x] **Delete API**: `DELETE /api/admin/scripts/nodes/[id]` with cascading deletes.
- [x] **Position API**: `PATCH /api/admin/scripts/positions` for bulk layout saving.
- [x] **Save Functionality**: Wiring up "Save" button to persist changes.
- [x] **Toolbar Actions**: Auto-layout, Validation, and Export features.

---

## 🚀 Phase 5: Feature Completion & UX Polish (Next Up)
**Goal:** Complete the editor lifecycle (Create/Delete) and improve user experience.

### 5.0 Performance Optimization (Completed)
- [x] **Loading Speed**: Optimized API to use parallel queries (reduced queries from ~250 to 5).
- [x] **Stability**: Fixed editor reloading when switching browser tabs.

### 5.1 Create Node Functionality
- **Objective**: Allow admins to add completely new nodes.
- **Plan**:
  - [x] Add "Library" or "Add Node" panel in the sidebar.
  - [x] Implement drag-and-drop from library to canvas (creating a new node instance).
  - [x] Default node templates (Opening, Object, Close, etc.).
  - [x] `POST /api/admin/scripts/nodes` integration.

### 5.2 Delete Node UI
- **Objective**: Allow safe removal of nodes.
- **Plan**:
  - [x] Wire up the trash icon on ScriptNode.
  - [x] Create confirmation modal ("Are you sure? This will break X connections...").
  - [x] Call Delete API and update local graph state.

### 5.3 UX Improvements (Completed)
- **Toast Notifications**:
  - [x] Install `sonner` or `react-hot-toast`.
  - [x] Replace all `alert()` calls with nice toasts (Success, Error, Info).
- **Search & Filter**:
  - [x] Implement search bar in toolbar to highlight/zoom to nodes matching text.
- **Connect & Disconnect UX**:
  - [x] Validate connections in real-time (don't allow connecting to self, etc.).
  - [x] Visual cues when connection is valid/invalid.

### 5.4 Import Functionality (Completed)
- **Objective**: Restore from backups.
- **Plan**:
  - [x] Implement `handleImport` logic to parse JSON.
  - [x] options to "Merge" or "Overwrite" existing flow.

---

## 🔮 Phase 6: Advanced Capabilities (Future)
**Goal:** Enterprise-grade features for collaboration and safety.

## ✅ Phase 6.1: Safety Features (Completed)
- **Undo/Redo**: Implemented history stack command pattern (Ctrl+Z/Y).
- **Version History**:
  - [x] Store snapshots of flow in a `script_versions` table.
  - [x] UI to browse and restore past versions.

## ✅ Phase 6.2: Collaboration (Completed)
- **Locking**: Prevented two admins from editing the same node simultaneously with a real-time locking system.
- **Presence**: Added real-time presence indicators to show who else is currently viewing the editor.

## ✅ Phase 6.3: Analytics (Completed)
- **Usage Heatmaps**: Implemented navigation logging and a visual heatmap overlay in the editor to show node popularity.
