import dagre from "dagre";
import { Node, Edge } from "@xyflow/react";

export interface LayoutConfig {
  direction?: "TB" | "LR" | "BT" | "RL";
  nodeWidth?: number;
  nodeHeight?: number;
  nodeSeparation?: number;
  rankSeparation?: number;
}

/**
 * Auto-layout nodes using dagre hierarchical layout algorithm
 */
export function autoLayoutNodes(
  nodes: Node[],
  edges: Edge[],
  config: LayoutConfig = {}
): Node[] {
  const {
    direction = "TB", // Top to bottom
    nodeWidth = 250,
    nodeHeight = 150,
    nodeSeparation = 100,
    rankSeparation = 150,
  } = config;

  // Create dagre graph
  const g = new dagre.graphlib.Graph();

  // Configure graph
  g.setGraph({
    rankdir: direction,
    nodesep: nodeSeparation,
    ranksep: rankSeparation,
    align: "UL", // Up-left alignment
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Add nodes to graph
  nodes.forEach((node) => {
    g.setNode(node.id, {
      width: nodeWidth,
      height: nodeHeight,
    });
  });

  // Add edges to graph
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  // Run layout algorithm
  dagre.layout(g);

  // Extract positions and update nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = g.node(node.id);

    return {
      ...node,
      position: {
        // dagre returns center position, we need top-left
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return layoutedNodes;
}

/**
 * Calculate topic-based layout where nodes are grouped by topic
 */
export function topicBasedLayout(
  nodes: Node[],
  edges: Edge[],
  config: LayoutConfig = {}
): Node[] {
  const { nodeWidth = 250, nodeHeight = 150, nodeSeparation = 100 } = config;

  // Group nodes by topic (if available in node data)
  const nodesByTopic = new Map<string, Node[]>();
  const nodesWithoutTopic: Node[] = [];

  nodes.forEach((node) => {
    const topicId = node.data?.topicGroupId as string | undefined;
    if (topicId) {
      if (!nodesByTopic.has(topicId)) {
        nodesByTopic.set(topicId, []);
      }
      nodesByTopic.get(topicId)!.push(node);
    } else {
      nodesWithoutTopic.push(node);
    }
  });

  // Layout each topic group vertically
  let currentY = 0;
  const layoutedNodes: Node[] = [];

  nodesByTopic.forEach((topicNodes) => {
    let currentX = 0;

    topicNodes.forEach((node, index) => {
      layoutedNodes.push({
        ...node,
        position: {
          x: currentX,
          y: currentY,
        },
      });

      // Move to next column if needed
      if ((index + 1) % 3 === 0) {
        currentX = 0;
        currentY += nodeHeight + nodeSeparation;
      } else {
        currentX += nodeWidth + nodeSeparation;
      }
    });

    // Move to next topic group
    currentY += nodeHeight + nodeSeparation * 2;
  });

  // Add nodes without topic at the end
  let currentX = 0;
  nodesWithoutTopic.forEach((node, index) => {
    layoutedNodes.push({
      ...node,
      position: {
        x: currentX,
        y: currentY,
      },
    });

    if ((index + 1) % 3 === 0) {
      currentX = 0;
      currentY += nodeHeight + nodeSeparation;
    } else {
      currentX += nodeWidth + nodeSeparation;
    }
  });

  return layoutedNodes;
}
