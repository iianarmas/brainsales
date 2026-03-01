"use client";

import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useKbStore } from "@/store/useKbStore";
import { QuickReferenceData, QuickReferenceCompetitor } from "@/types/product";

export function useQuickReferenceRealtime(productId: string | undefined) {
    const { session } = useAuth();
    const { setQuickReference } = useKbStore();
    const channelRef = useRef<any>(null);

    const fetchLatest = useCallback(async () => {
        if (!productId || !session?.access_token) return;

        try {
            const response = await fetch(
                `/api/products/${productId}/quick-reference`,
                {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                }
            );

            if (!response.ok) return;

            const quickRefData: QuickReferenceData = await response.json();
            setQuickReference(productId, quickRefData);
        } catch (err) {
            console.error("[Realtime] Error refreshing quick reference:", err);
        }
    }, [productId, session?.access_token, setQuickReference]);

    useEffect(() => {
        if (!productId || !session?.access_token) return;

        // Clean up existing channel
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        // Create new channel for this product's quick reference
        const channelName = `quick-reference:${productId}`;

        const channel = supabase
            .channel(channelName)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "product_quick_reference",
                    filter: `product_id=eq.${productId}`,
                },
                (payload) => {
                    console.log("[Realtime] Quick reference change detected:", payload);
                    // When any change happens to this product's quick reference,
                    // the simplest and most reliable way is to re-fetch the whole transformed object
                    fetchLatest();
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] Quick reference subscription status for ${productId}:`, status);
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [productId, session?.access_token, fetchLatest]);
}
