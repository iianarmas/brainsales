import { replaceScriptPlaceholders } from "../src/utils/replaceScriptPlaceholders";
import { UserProfile } from "../src/types/profile";
import { CallMetadata } from "../src/store/callStore";

const mockProfile: UserProfile = {
    id: "user-123",
    user_id: "user-auth-123",
    first_name: "John",
    last_name: "Doe",
    profile_picture_url: null,
    company_email: "john@314ecorp.us",
    company_phone_number: "+1.608.597.4334",
    role: "Sales Director",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
};

const mockMetadata: CallMetadata = {
    prospectName: "Jane Smith",
    phoneNumber: "+1.555.000.1111",
    status: "idle",
    startTime: null,
    duration: 0,
};

const testScript = `
Hi \${phone}, this is [First] calling from 314e.
I'm the \${role} here.
How are you [Name]?
You can reach me at 608-597-4334 or [your email].
`;

const result = replaceScriptPlaceholders(testScript, mockProfile, mockMetadata);

console.log("--- Original Script ---");
console.log(testScript);
console.log("\n--- Processed Script ---");
console.log(result);

const expectedPhone = "608-597-4334";
const expectedRole = "Sales Director";

if (result.includes(expectedPhone) && result.includes(expectedRole) && !result.includes("${phone}") && !result.includes("${role}")) {
    console.log("\n✅ Verification Successful!");
} else {
    console.log("\n❌ Verification Failed!");
    process.exit(1);
}
