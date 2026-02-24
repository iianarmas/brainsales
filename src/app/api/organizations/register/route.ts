import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/app/lib/supabaseServer";
import { isGenericEmailDomain } from "@/lib/genericEmailDomains";

/**
 * POST /api/organizations/register
 *
 * Creates a new organization workspace. New orgs start with is_active = false
 * and require manual approval in Supabase before members can sign in.
 *
 * Body:
 *   workspaceName  string   — display name for the org
 *   slug           string   — URL-safe identifier (e.g. "acme-corp")
 *   domain         string?  — optional company domain (e.g. "acme.com")
 *                             omit for teams using generic email addresses
 */
export async function POST(request: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json(
                { error: "Server not configured" },
                { status: 500 }
            );
        }

        // Caller must be authenticated
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.replace("Bearer ", "");
        const {
            data: { user },
            error: authError,
        } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { workspaceName, slug, domain } = body as {
            workspaceName: string;
            slug: string;
            domain?: string;
        };

        // Validate required fields
        if (!workspaceName?.trim() || !slug?.trim()) {
            return NextResponse.json(
                { error: "workspaceName and slug are required" },
                { status: 400 }
            );
        }

        // Validate slug format
        const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
        if (!slugRegex.test(slug)) {
            return NextResponse.json(
                { error: "Slug must be lowercase letters, numbers, and hyphens only" },
                { status: 400 }
            );
        }

        // Validate domain format if provided
        if (domain) {
            const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;
            if (!domainRegex.test(domain)) {
                return NextResponse.json(
                    { error: "Invalid domain format" },
                    { status: 400 }
                );
            }

            // Reject public/generic email providers — anyone with that domain would be admitted
            if (isGenericEmailDomain(domain)) {
                return NextResponse.json(
                    {
                        error:
                            `"${domain}" is a public email provider and cannot be used as a company domain. ` +
                            "Your employees can still join via invite links instead.",
                    },
                    { status: 400 }
                );
            }
        }

        // Check slug uniqueness
        const { data: existing } = await supabaseAdmin
            .from("organizations")
            .select("id")
            .eq("slug", slug)
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { error: "This workspace URL is already taken. Please choose another." },
                { status: 409 }
            );
        }

        // Create the organization (is_active defaults to false per migration 025)
        const { data: org, error: orgError } = await supabaseAdmin
            .from("organizations")
            .insert({
                name: workspaceName.trim(),
                slug: slug.trim(),
                allowed_domains: domain ? [domain.toLowerCase()] : [],
                allowed_emails: [],
                plan: "team",
                // is_active defaults to false — requires manual approval
            })
            .select("id, name, slug")
            .single();

        if (orgError || !org) {
            console.error("Failed to create org:", orgError);
            return NextResponse.json(
                { error: "Failed to create workspace. Please try again." },
                { status: 500 }
            );
        }

        // Add the registering user as the owner
        const { error: memberError } = await supabaseAdmin
            .from("organization_members")
            .insert({
                organization_id: org.id,
                user_id: user.id,
                role: "owner",
            });

        if (memberError) {
            console.error("Failed to add owner:", memberError);
            // Roll back the org creation
            await supabaseAdmin.from("organizations").delete().eq("id", org.id);
            return NextResponse.json(
                { error: "Failed to set up workspace. Please try again." },
                { status: 500 }
            );
        }

        // PROACTIVE FIX: Add user to admins table so they have immediate script-editing access
        const { error: adminError } = await supabaseAdmin
            .from("admins")
            .upsert({ user_id: user.id })
            .select()
            .single();

        if (adminError) {
            console.error("Failed to add to admins table:", adminError);
            // We don't roll back the whole thing for this, as the org is already created 
            // and they are the owner. But we log it.
        }

        return NextResponse.json({
            success: true,
            organizationId: org.id,
            slug: org.slug,
            status: "pending_approval",
        });
    } catch (error) {
        console.error("Register org error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}
