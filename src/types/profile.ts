export interface UserProfile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  profile_picture_url: string | null;
  company_email: string | null;
  company_phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileFormData {
  first_name: string;
  last_name: string;
  company_email: string;
  company_phone_number: string;
  profile_picture?: File;
}
