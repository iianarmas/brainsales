import { UserProfile } from "@/types/profile";
import { CallMetadata } from "@/store/callStore";

export function replaceScriptPlaceholders(
  script: string,
  profile: UserProfile | null,
  metadata: CallMetadata
): string {
  let processedScript = script;

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

  // Replace hardcoded phone number 608-597-4334 with user's company phone
  if (profile?.company_phone_number) {
    // Format the phone number to match the script format (XXX-XXX-XXXX)
    const formattedPhone = profile.company_phone_number
      .replace(/^\+1\./, '') // Remove +1. prefix
      .replace(/\./g, '-');   // Replace dots with dashes
    processedScript = processedScript.replace(/608-597-4334/g, formattedPhone);
  }

  return processedScript;
}
