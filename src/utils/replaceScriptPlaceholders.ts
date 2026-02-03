import { UserProfile } from "@/types/profile";
import { CallMetadata } from "@/store/callStore";

export function replaceScriptPlaceholders(
  script: string,
  profile: UserProfile | null,
  metadata: CallMetadata
): string {
  let processedScript = script;

  // --- New {variable} Format ---

  // Replace {first} with user's first name
  if (profile?.first_name) {
    processedScript = processedScript.replace(/\{first\}/g, profile.first_name);
  }

  // Replace {last} with user's last name
  if (profile?.last_name) {
    processedScript = processedScript.replace(/\{last\}/g, profile.last_name);
  }

  // Replace {full_name} with user's full name
  if (profile?.first_name && profile?.last_name) {
    processedScript = processedScript.replace(/\{full_name\}/g, `${profile.first_name} ${profile.last_name}`);
  }

  // Replace {prospect} with prospect name from metadata
  if (metadata.prospectName) {
    processedScript = processedScript.replace(/\{prospect\}/g, metadata.prospectName);
  }

  // Replace {phone} with user's company phone (xxx-xxx-xxxx)
  if (profile?.company_phone_number) {
    const formattedPhone = profile.company_phone_number
      .replace(/^\+1\./, "")
      .replace(/\./g, "-");
    processedScript = processedScript.replace(/\{phone\}/g, formattedPhone);
  }

  // Replace {phone_format} with user's company phone in +1.xxx.xxx.xxxx format
  if (profile?.company_phone_number) {
    processedScript = processedScript.replace(/\{phone_format\}/g, profile.company_phone_number);
  }

  // Replace {email} with user's company email
  if (profile?.company_email) {
    processedScript = processedScript.replace(/\{email\}/g, profile.company_email);
  }

  // Replace {role} with user's role
  if (profile?.role) {
    processedScript = processedScript.replace(/\{role\}/g, profile.role);
  }

  // --- Legacy Support ---

  // Replace [First] with user's first name
  if (profile?.first_name) {
    processedScript = processedScript.replace(/\[First\]/g, profile.first_name);
  }

  // Replace [Name] with prospect name from metadata
  if (metadata.prospectName) {
    processedScript = processedScript.replace(/\[Name\]/g, metadata.prospectName);
  }

  // Replace [your email] with user's company email
  if (profile?.company_email) {
    processedScript = processedScript.replace(/\[your email\]/g, profile.company_email);
  }

  // Replace hardcoded phone number 608-597-4334 and legacy ${phone}
  if (profile?.company_phone_number) {
    const formattedPhone = profile.company_phone_number
      .replace(/^\+1\./, "")
      .replace(/\./g, "-");

    processedScript = processedScript.replace(/608-597-4334/g, formattedPhone);
    processedScript = processedScript.replace(/\$\{phone\}/g, formattedPhone);
  }

  // Replace legacy ${role}
  if (profile?.role) {
    processedScript = processedScript.replace(/\$\{role\}/g, profile.role);
  }

  return processedScript;
}
