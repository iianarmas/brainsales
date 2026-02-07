// Product Types for Multi-Product Architecture

export type ProductRole = 'viewer' | 'user' | 'admin' | 'super_admin';

export interface ProductConfiguration {
  painPoints?: string[];
  meetingSubject?: string;
  meetingBody?: string;
  zoomLink?: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  configuration?: ProductConfiguration | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductUser {
  product_id: string;
  user_id: string;
  role: ProductRole;
  is_default: boolean;
  joined_at: string;
  // Joined fields
  product?: Product;
}

export interface ProductWithRole extends Product {
  role: ProductRole;
  is_default: boolean;
}

// Quick Reference Types
export type QuickReferenceSection = 'differentiators' | 'competitors' | 'metrics' | 'tips';

export interface QuickReferenceEntry {
  id: string;
  product_id: string;
  section: QuickReferenceSection;
  data: QuickReferenceDifferentiators | QuickReferenceCompetitors | QuickReferenceMetrics | QuickReferenceTips;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Differentiators are an array of strings
export type QuickReferenceDifferentiators = string[];

// Competitors is an array of competitor objects
export interface QuickReferenceCompetitor {
  id: string; // Internal ID for keys/sorting
  name: string;
  strengths: string[];
  limitations: string[];
  advantage: string;
}

export type QuickReferenceCompetitors = QuickReferenceCompetitor[];

// Metrics is an array of value/label pairs
export interface QuickReferenceMetric {
  id?: string; // Optional id for reordering
  value: string;
  label: string;
}

export type QuickReferenceMetrics = QuickReferenceMetric[];

// Tips is an array of strings
export type QuickReferenceTips = string[];

// Combined quick reference data structure (matches current usage)
export interface QuickReferenceData {
  differentiators: string[];
  competitors: QuickReferenceCompetitors;
  metrics: QuickReferenceMetric[];
  tips: string[];
}

// Objection Shortcuts Types
export interface ObjectionShortcut {
  id: string;
  product_id: string;
  node_id: string;
  shortcut_key: string; // '0' - '9'
  label: string | null;
  sort_order: number;
  created_at: string;
}

// Map of shortcut key to node ID
export type ObjectionShortcutMap = Record<string, string>;

// Map of node ID to shortcut key (reverse lookup)
export type ObjectionNodeMap = Record<string, string>;

// API Response types
export interface ProductsResponse {
  products: ProductWithRole[];
}

export interface QuickReferenceResponse {
  differentiators: string[];
  competitors: QuickReferenceCompetitors;
  metrics: QuickReferenceMetric[];
  tips: string[];
}

export interface ObjectionShortcutsResponse {
  shortcuts: ObjectionShortcut[];
  // Convenience maps
  keyToNode: ObjectionShortcutMap;
  nodeToKey: ObjectionNodeMap;
}

// User-level objection preference types
export interface UserObjectionPreference {
  node_id: string;
  shortcut_key: string | null;
}

export interface UserObjectionPreferencesResponse {
  customized: boolean;
  preferences: UserObjectionPreference[];
  keyToNode: ObjectionShortcutMap;
  nodeToKey: ObjectionNodeMap;
}

// Form data for admin editing
export interface ProductFormData {
  name: string;
  slug: string;
  description: string;
  logo_url?: string;
  is_active: boolean;
}

export interface QuickReferenceFormData {
  differentiators: string[];
  competitors: QuickReferenceCompetitors;
  metrics: QuickReferenceMetric[];
  tips: string[];
}

export interface ObjectionShortcutFormData {
  shortcuts: Array<{
    node_id: string;
    shortcut_key: string;
    label?: string;
  }>;
}
