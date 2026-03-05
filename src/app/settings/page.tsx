"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { LoginForm } from "@/components/LoginForm";
import { LoadingScreen } from "@/components/LoadingScreen";
import { ThemeCustomizer } from "@/components/ThemeCustomizer";
import { ShortcutsTab } from "@/components/settings/ShortcutsTab";
import { useThemeStore } from "@/store/themeStore";
import { formatPhoneNumber, validatePhoneNumber } from "@/utils/phoneNumber";
import {
  ArrowLeft,
  User,
  Palette,
  Keyboard,
  Upload,
  Check,
  AlertCircle,
  Loader2,
  Moon,
  Sun,
} from "lucide-react";

type Tab = "profile" | "appearance" | "shortcuts";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
];

export default function SettingsPage() {
  const { user, profile, session, loading, refreshProfile } = useAuth() as {
    user: { email?: string } | null;
    profile: {
      first_name?: string | null;
      last_name?: string | null;
      company_email?: string | null;
      company_phone_number?: string | null;
      role?: string | null;
      zoom_link?: string | null;
      profile_picture_url?: string | null;
    } | null;
    session: { access_token: string } | null;
    loading: boolean;
    refreshProfile: () => Promise<void>;
  };

  const { primaryColor, setPrimaryColor, setPreviewColor, theme, toggleTheme } = useThemeStore();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // Profile form state
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    company_email: "",
    company_phone_number: "",
    role: "",
    zoom_link: "",
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Appearance state
  const [pendingColor, setPendingColor] = useState(primaryColor);
  useEffect(() => {
    setPreviewColor(pendingColor);
  }, [pendingColor, setPreviewColor]);

  // Populate form from profile
  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name ?? "",
        last_name: profile.last_name ?? "",
        company_email: profile.company_email ?? "",
        company_phone_number: profile.company_phone_number ?? "",
        role: profile.role ?? "",
        zoom_link: profile.zoom_link ?? "",
      });
      setPreviewUrl(profile.profile_picture_url ?? null);
    }
  }, [profile]);

  if (loading) return <LoadingScreen fullScreen />;
  if (!user) return <LoginForm />;

  const capitalizeFirst = (v: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v);

  const handleInputChange = (field: string, value: string) => {
    if (field === "company_phone_number") value = formatPhoneNumber(value);
    else if (field === "first_name" || field === "last_name") value = capitalizeFirst(value);
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setProfileMessage({ type: "error", text: "Only JPG, PNG, and WebP images are allowed" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfileMessage({ type: "error", text: "File size must be less than 5MB" });
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.first_name.trim()) newErrors.first_name = "First name is required";
    if (!formData.last_name.trim()) newErrors.last_name = "Last name is required";
    if (!formData.company_email.trim()) newErrors.company_email = "Company email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.company_email))
      newErrors.company_email = "Invalid email format";
    if (!formData.company_phone_number.trim()) newErrors.company_phone_number = "Phone number is required";
    else if (!validatePhoneNumber(formData.company_phone_number))
      newErrors.company_phone_number = "Phone must be in format +1.XXX.XXX.XXXX";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!validateForm()) return;
    setProfileSaving(true);
    setProfileMessage(null);
    try {
      let profile_picture_url = profile?.profile_picture_url;

      if (selectedFile) {
        const fd = new FormData();
        fd.append("file", selectedFile);
        const upRes = await fetch("/api/profile/upload-picture", {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: fd,
        });
        if (!upRes.ok) throw new Error((await upRes.json()).error || "Failed to upload picture");
        profile_picture_url = (await upRes.json()).url;
      }

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ ...formData, profile_picture_url: profile_picture_url ?? null }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save profile");

      await refreshProfile();
      setSelectedFile(null);
      setProfileMessage({ type: "success", text: "Profile saved successfully!" });
    } catch (err) {
      setProfileMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save profile",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSaveAppearance = () => {
    setPrimaryColor(pendingColor);
    setPreviewColor(null);
    setProfileMessage({ type: "success", text: "Appearance saved!" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to BrainSales
        </Link>

        <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

        {/* Tab nav */}
        <div className="flex gap-1 bg-muted/40 p-1 rounded-xl mb-8 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Profile tab ── */}
        {activeTab === "profile" && (
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-6">
            {profileMessage && activeTab === "profile" && (
              <div
                className={`p-4 rounded-lg flex items-center gap-2 border ${
                  profileMessage.type === "success"
                    ? "bg-success/10 text-success-foreground border-success/20"
                    : "bg-destructive/10 text-destructive-foreground border-destructive/20"
                }`}
              >
                {profileMessage.type === "success" ? (
                  <Check className="h-5 w-5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                )}
                <p className="text-sm font-semibold">{profileMessage.text}</p>
              </div>
            )}

            {/* Profile picture */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Profile Picture</label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Profile"
                      className="h-20 w-20 rounded-full object-cover border-4 border-primary/70"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-full bg-muted border-4 border-primary/70 flex items-center justify-center">
                      <User className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={profileSaving}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm"
                  >
                    <Upload className="h-4 w-4" />
                    Upload Picture
                  </button>
                  {previewUrl && (
                    <button
                      onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                      disabled={profileSaving}
                      className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors border border-border text-sm"
                    >
                      Remove
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Max 5MB.</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>

            {/* Name fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  First Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange("first_name", e.target.value)}
                  className={`w-full px-3 py-2 bg-background text-foreground border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm ${
                    errors.first_name ? "border-destructive" : "border-border"
                  }`}
                  placeholder="First name"
                  disabled={profileSaving}
                />
                {errors.first_name && <p className="text-xs text-destructive mt-1">{errors.first_name}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Last Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange("last_name", e.target.value)}
                  className={`w-full px-3 py-2 bg-background text-foreground border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm ${
                    errors.last_name ? "border-destructive" : "border-border"
                  }`}
                  placeholder="Last name"
                  disabled={profileSaving}
                />
                {errors.last_name && <p className="text-xs text-destructive mt-1">{errors.last_name}</p>}
              </div>
            </div>

            {/* Company email */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Company Email <span className="text-destructive">*</span>
              </label>
              <input
                type="email"
                value={formData.company_email}
                onChange={(e) => handleInputChange("company_email", e.target.value)}
                className={`w-full px-3 py-2 bg-background text-foreground border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm ${
                  errors.company_email ? "border-destructive" : "border-border"
                }`}
                placeholder="your.email@company.com"
                disabled={profileSaving}
              />
              {errors.company_email && <p className="text-xs text-destructive mt-1">{errors.company_email}</p>}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Company Phone <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={formData.company_phone_number}
                onChange={(e) => handleInputChange("company_phone_number", e.target.value)}
                className={`w-full px-3 py-2 bg-background text-foreground border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm ${
                  errors.company_phone_number ? "border-destructive" : "border-border"
                }`}
                placeholder="+1.XXX.XXX.XXXX"
                disabled={profileSaving}
              />
              {errors.company_phone_number && (
                <p className="text-xs text-destructive mt-1">{errors.company_phone_number}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Format: +1.XXX.XXX.XXXX</p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Current Role</label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => handleInputChange("role", e.target.value)}
                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm"
                placeholder="e.g. Sales Manager"
                disabled={profileSaving}
              />
              <p className="text-xs text-muted-foreground mt-1">Used for the {`{role}`} variable in scripts.</p>
            </div>

            {/* Zoom link */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Personal Zoom Link</label>
              <input
                type="text"
                value={formData.zoom_link}
                onChange={(e) => handleInputChange("zoom_link", e.target.value)}
                className="w-full px-3 py-2 bg-background text-foreground border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors text-sm"
                placeholder="https://zoom.us/j/..."
                disabled={profileSaving}
              />
              <p className="text-xs text-muted-foreground mt-1">Used as the Zoom link in your meeting details.</p>
            </div>

            {/* Save */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveProfile}
                disabled={profileSaving}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 font-semibold text-sm shadow-sm"
              >
                {profileSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Profile"
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Appearance tab ── */}
        {activeTab === "appearance" && (
          <div className="bg-surface border border-border rounded-2xl p-6 space-y-6">
            {profileMessage && activeTab === "appearance" && (
              <div className="p-4 rounded-lg flex items-center gap-2 border bg-success/10 text-success-foreground border-success/20">
                <Check className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm font-semibold">{profileMessage.text}</p>
              </div>
            )}
            {/* Dark mode toggle */}
            <div className="flex items-center justify-between p-4 bg-surface-elevated rounded-xl border border-border">
              <div className="flex items-center gap-3">
                {theme === 'dark' ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
                <div>
                  <p className="text-sm font-semibold text-foreground">Dark Mode</p>
                  <p className="text-xs text-muted-foreground">{theme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme'}</p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                style={{ backgroundColor: theme === 'dark' ? 'var(--primary)' : 'var(--muted)' }}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${theme === 'dark' ? 'translate-x-[26px]' : 'translate-x-1'}`}
                />
              </button>
            </div>

            <ThemeCustomizer selectedColor={pendingColor} onColorChange={setPendingColor} />
            <div className="flex justify-end pt-2">
              <button
                onClick={handleSaveAppearance}
                className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-semibold text-sm shadow-sm"
              >
                Save Appearance
              </button>
            </div>
          </div>
        )}

        {/* ── Shortcuts tab ── */}
        {activeTab === "shortcuts" && (
          <div className="bg-surface border border-border rounded-2xl p-6">
            <ShortcutsTab />
          </div>
        )}
      </div>
    </div>
  );
}
