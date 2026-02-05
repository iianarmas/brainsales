// ============================================================
// Competitor Types - Product-specific competitor intelligence
// ============================================================

export type CompetitorStatus = 'active' | 'archived';

export interface Competitor {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  description: string | null;
  // Structured comparison data
  strengths: string[];
  limitations: string[];
  our_advantage: string | null;
  // Rich content fields
  positioning: string | null;
  target_market: string | null;
  pricing_info: string | null;
  // Metadata
  status: CompetitorStatus;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitorFormData {
  name: string;
  slug?: string;
  logo_url?: string;
  website?: string;
  description?: string;
  strengths: string[];
  limitations: string[];
  our_advantage?: string;
  positioning?: string;
  target_market?: string;
  pricing_info?: string;
}

export interface CreateCompetitorPayload {
  product_id: string;
  name: string;
  slug?: string;
  logo_url?: string;
  website?: string;
  description?: string;
  strengths?: string[];
  limitations?: string[];
  our_advantage?: string;
  positioning?: string;
  target_market?: string;
  pricing_info?: string;
}

export interface UpdateCompetitorPayload {
  name?: string;
  slug?: string;
  logo_url?: string;
  website?: string;
  description?: string;
  strengths?: string[];
  limitations?: string[];
  our_advantage?: string;
  positioning?: string;
  target_market?: string;
  pricing_info?: string;
  status?: CompetitorStatus;
  sort_order?: number;
}

export interface CompetitorFilters {
  product_id?: string;
  status?: CompetitorStatus;
  search?: string;
}
