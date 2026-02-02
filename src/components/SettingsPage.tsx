"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { formatPhoneNumber, validatePhoneNumber } from "@/utils/phoneNumber";
import { X, Upload, User, Check, AlertCircle } from "lucide-react";

interface SettingsPageProps {
  onClose: () => void;
}

export function SettingsPage({ onClose }: SettingsPageProps) {
  const { profile, session, refreshProfile } = useAuth();
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to capitalize first letter
  const capitalizeFirstLetter = (value: string) => {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  };

  useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        company_email: profile.company_email || "",
        company_phone_number: profile.company_phone_number || "",
        role: profile.role || "",
        zoom_link: profile.zoom_link || "",
      });
      setPreviewUrl(profile.profile_picture_url);
    }
  }, [profile]);

  const handleInputChange = (field: string, value: string) => {
    if (field === "company_phone_number") {
      value = formatPhoneNumber(value);
    } else if (field === "first_name" || field === "last_name") {
      value = capitalizeFirstLetter(value);
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setMessage({ type: "error", text: "Only JPG, PNG, and WebP images are allowed" });
        return;
      }

      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "error", text: "File size must be less than 5MB" });
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePicture = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.first_name.trim()) {
      newErrors.first_name = "First name is required";
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = "Last name is required";
    }

    if (!formData.company_email.trim()) {
      newErrors.company_email = "Company email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.company_email)) {
      newErrors.company_email = "Invalid email format";
    }

    if (!formData.company_phone_number.trim()) {
      newErrors.company_phone_number = "Phone number is required";
    } else if (!validatePhoneNumber(formData.company_phone_number)) {
      newErrors.company_phone_number = "Phone must be in format +1.XXX.XXX.XXXX";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      let profile_picture_url = profile?.profile_picture_url;

      // Upload profile picture if selected
      if (selectedFile) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", selectedFile);

        const uploadResponse = await fetch("/api/profile/upload-picture", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "Failed to upload picture");
        }

        const uploadData = await uploadResponse.json();
        profile_picture_url = uploadData.url;
      }

      // Update profile
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          ...formData,
          profile_picture_url: profile_picture_url || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save profile");
      }

      // Refresh profile in context
      await refreshProfile();

      setMessage({ type: "success", text: "Profile saved successfully!" });
      setSelectedFile(null);

      // Close modal after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      console.error("Save error:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save profile",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-primary/10 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <h2 className="text-2xl font-bold text-gray-900">Profile Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Message Banner */}
          {message && (
            <div
              className={`p-4 rounded-lg flex items-center gap-2 ${message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
                }`}
            >
              {message.type === "success" ? (
                <Check className="h-5 w-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {/* Profile Picture */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Profile Picture
            </label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Profile preview"
                    className="h-24 w-24 rounded-full object-cover border-4 border-primary/70"
                  />
                ) : (
                  <div className="h-24 w-24 rounded-full bg-gray-100 border-4 border-primary/70 flex items-center justify-center">
                    <User className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
                  disabled={loading}
                >
                  <Upload className="h-4 w-4" />
                  Upload Picture
                </button>
                {previewUrl && (
                  <button
                    onClick={handleRemovePicture}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    disabled={loading}
                  >
                    Remove Picture
                  </button>
                )}
                <p className="text-xs text-gray-500">JPG, PNG, or WebP. Max 5MB.</p>
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

          {/* First Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => handleInputChange("first_name", e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary ${errors.first_name ? "border-red-500" : "border-primary/20"
                }`}
              placeholder="Enter your first name"
              disabled={loading}
            />
            {errors.first_name && (
              <p className="text-sm text-red-600 mt-1">{errors.first_name}</p>
            )}
          </div>

          {/* Last Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => handleInputChange("last_name", e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary ${errors.last_name ? "border-red-500" : "border-primary/20"
                }`}
              placeholder="Enter your last name"
              disabled={loading}
            />
            {errors.last_name && (
              <p className="text-sm text-red-600 mt-1">{errors.last_name}</p>
            )}
          </div>

          {/* Company Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Company Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={formData.company_email}
              onChange={(e) => handleInputChange("company_email", e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary ${errors.company_email ? "border-red-500" : "border-primary/20"
                }`}
              placeholder="your.email@314ecorp.us"
              disabled={loading}
            />
            {errors.company_email && (
              <p className="text-sm text-red-600 mt-1">{errors.company_email}</p>
            )}
          </div>

          {/* Company Phone Number */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Company Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.company_phone_number}
              onChange={(e) => handleInputChange("company_phone_number", e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary ${errors.company_phone_number ? "border-red-500" : "border-primary/20"
                }`}
              placeholder="+1.XXX.XXX.XXXX"
              disabled={loading}
            />
            {errors.company_phone_number && (
              <p className="text-sm text-red-600 mt-1">{errors.company_phone_number}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">Format: +1.XXX.XXX.XXXX</p>
          </div>

          {/* Current Role */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Current Role
            </label>
            <input
              type="text"
              value={formData.role}
              onChange={(e) => handleInputChange("role", e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary border-primary/20`}
              placeholder="e.g. Sales Manager"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">This will be used for the {`{role}`} variable in your scripts.</p>
          </div>

          {/* Zoom Link */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Personal Zoom Link
            </label>
            <input
              type="text"
              value={formData.zoom_link}
              onChange={(e) => handleInputChange("zoom_link", e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary border-primary/20`}
              placeholder="https://314e.zoom.us/j/..."
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">This will be used as the Zoom Link in your meeting details.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-primary/10 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              "Save Profile"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
