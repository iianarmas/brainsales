"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useCallStore } from "@/store/callStore";
import { topicGroups as staticTopicGroups, getTopicForNode, TopicGroup } from "@/data/topicGroups";
import { isNodeInFlow } from "@/data/callFlow";
import { useProduct } from "@/context/ProductContext";
import { useAuth } from "@/context/AuthContext";
import * as LucideIcons from "lucide-react";

export function TopicNav() {
  const { currentNodeId, navigateTo, scripts, activeCallFlowId } = useCallStore();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const [dynamicTopics, setDynamicTopics] = useState<TopicGroup[]>(staticTopicGroups);
  const navRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const { currentProduct } = useProduct();
  const { session } = useAuth();

  // Fetch dynamic topics when product changes
  useEffect(() => {
    async function fetchTopics() {
      if (!currentProduct || !session?.access_token) {
        setDynamicTopics(staticTopicGroups);
        return;
      }

      try {
        const res = await fetch(`/api/products/${currentProduct.id}/config`, {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.topics && data.topics.length > 0) {
            // Map API topics to component format (resolve icons)
            const mappedTopics = data.topics.map((t: any) => ({
              id: t.id,
              label: t.label,
              // Dynamically resolve icon, fallback to Circle
              icon: (LucideIcons as any)[t.icon] || LucideIcons.Circle,
              color: t.color,
              nodes: [], // Nodes are resolved dynamically via getNodesForTopic
            }));
            setDynamicTopics(mappedTopics);
          } else {
            // Fallback to static if no dynamic topics configured
            setDynamicTopics(staticTopicGroups);
          }
        }
      } catch (err) {
        console.error("Failed to fetch topics", err);
        setDynamicTopics(staticTopicGroups);
      }
    }

    fetchTopics();
  }, [currentProduct, session?.access_token]);


  // Helper to find topic for node (using dynamic list)
  const getCurrentTopic = () => {
    // First check explicit assignment in script data
    const node = scripts[currentNodeId] as any;
    if (node?.topic_group_id) {
      return dynamicTopics.find(t => t.id === node.topic_group_id);
    }
    // Fallback to static mapping logic if not explicitly set
    return getTopicForNode(currentNodeId);
  };

  const currentTopic = getCurrentTopic();

  // Helper to get nodes for a topic group
  const getNodesForTopic = (topicId: string) => {
    // API-driven topics don't have hardcoded 'nodes' array, so we rely on db property topic_group_id
    // But for static fallback, we still check the 'nodes' array.
    const staticDef = staticTopicGroups.find(t => t.id === topicId);
    const staticNodes = staticDef?.nodes || [];

    const result: string[] = [];
    const seen = new Set<string>();

    // First pass: add all nodes that have topic_group_id explicitly set to this topic
    for (const [id, node] of Object.entries(scripts)) {
      const n = node as any;
      if (n.topic_group_id === topicId) {
        if (!seen.has(id)) {
          seen.add(id);
          result.push(id);
        }
      }
    }

    // Second pass: add static nodes ONLY if we are using static topics OR if we want mixed mode?
    // Let's say if we are using dynamic topics, we ONLY rely on topic_group_id from DB.
    // If we are using static topics, we include the static definitions.
    const isUsingStatic = dynamicTopics === staticTopicGroups;

    if (isUsingStatic) {
      for (const id of staticNodes) {
        if (seen.has(id)) continue;
        const node = scripts[id];
        if (!node) continue;
        const n = node as any;
        if (n.topic_group_id == null) {
          seen.add(id);
          result.push(id);
        }
      }
    }

    // Filter by active call flow: only show universal nodes or nodes belonging to the active flow
    if (activeCallFlowId) {
      return result.filter(nodeId => {
        const node = scripts[nodeId];
        if (!node) return false;
        return isNodeInFlow(node, activeCallFlowId);
      });
    }

    return result;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside the nav or inside a portal dropdown
      const target = event.target as HTMLElement;
      const isInsideNav = navRef.current?.contains(target);
      const isInsidePortalDropdown = target.closest('[data-topic-dropdown]');
      if (!isInsideNav && !isInsidePortalDropdown) {
        setOpenDropdown(null);
        setDropdownPos(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenDropdown(null);
        setDropdownPos(null);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleNodeSelect = (nodeId: string) => {
    navigateTo(nodeId);
    setOpenDropdown(null);
    setDropdownPos(null);
  };

  const handleTopicClick = useCallback((topicId: string, isOpen: boolean) => {
    if (isOpen) {
      setOpenDropdown(null);
      setDropdownPos(null);
      return;
    }
    const btn = buttonRefs.current[topicId];
    if (btn) {
      const rect = btn.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpenDropdown(topicId);
  }, []);

  return (
    <div
      ref={navRef}
      className="fixed top-[52px] md:top-[60px] left-0 right-0 z-40 pt-2 md:pt-3 bg-white border-b border-gray-200 px-2 md:px-4 py-1.5 md:py-2"
    >
      <div className="flex items-center gap-1 overflow-x-auto md:overflow-visible scrollbar-hide md:flex-wrap pb-1 md:pb-0 -mx-2 px-2 md:mx-0 md:px-0">
        {dynamicTopics.map((topic) => {
          const Icon = topic.icon;
          const isActive = currentTopic?.id === topic.id;
          const isOpen = openDropdown === topic.id;
          const topicNodes = getNodesForTopic(topic.id);

          // Optional: Hide topics with no nodes if configured? For now show all.

          const dropdownContent = isOpen ? (
            <div className="max-h-[60vh] overflow-y-auto">
              {topicNodes.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 italic">No nodes</div>
              ) : (
                topicNodes.map((nodeId) => {
                  const node = scripts[nodeId];
                  if (!node) return null;

                  const isCurrentNode = currentNodeId === nodeId;

                  return (
                    <button
                      key={nodeId}
                      onClick={() => handleNodeSelect(nodeId)}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${isCurrentNode
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${isCurrentNode ? "bg-primary" : "bg-gray-300"
                            }`}
                        />
                        <span className="truncate">{node.title}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          ) : null;

          return (
            <div key={topic.id} className="relative">
              <button
                ref={(el) => { buttonRefs.current[topic.id] = el; }}
                onClick={() => handleTopicClick(topic.id, isOpen)}
                className={`inline-flex items-center gap-1 md:gap-1.5 px-2.5 md:px-3 py-1.5 md:py-1.5 text-xs md:text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${isActive
                  ? "bg-primary text-white"
                  : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
              >
                <Icon className="h-4 w-4" />
                <span>{topic.label}</span>
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""
                    }`}
                />
              </button>

              {/* Desktop Dropdown - absolute positioning works since parent has overflow-visible */}
              {dropdownContent && (
                <div className="hidden md:block absolute top-full left-0 mt-1 min-w-[200px] bg-white rounded-lg shadow-lg border border-primary/20 z-50 py-1">
                  {dropdownContent}
                </div>
              )}

              {/* Mobile Dropdown - portal to escape overflow-x-auto clipping */}
              {dropdownContent && dropdownPos && createPortal(
                <div
                  data-topic-dropdown
                  className="md:hidden fixed min-w-[200px] bg-white rounded-lg shadow-lg border border-primary/20 z-[100] py-1"
                  style={{ top: dropdownPos.top, left: Math.min(dropdownPos.left, window.innerWidth - 220) }}
                >
                  {dropdownContent}
                </div>,
                document.body
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}