import { Node, Edge } from "@xyflow/react";
import { CallNode } from "@/data/callFlow";

export interface ValidationError {
  type: "error" | "warning";
  nodeId?: string;
  message: string;
}

/**
 * Validates the call flow for common issues
 */
export function validateFlow(
  nodes: Node[],
  edges: Edge[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Check for orphaned nodes (nodes with no incoming edges, except opening)
  const nodesWithIncoming = new Set(edges.map((e) => e.target));
  nodes.forEach((node) => {
    const callNode = node.data?.callNode as CallNode;
    if (!callNode) return;

    // Skip opening nodes - they're supposed to be entry points
    if (callNode.type === "opening") return;

    if (!nodesWithIncoming.has(node.id)) {
      errors.push({
        type: "warning",
        nodeId: node.id,
        message: `Node "${callNode.title}" has no incoming connections (orphaned)`,
      });
    }
  });

  // Check for nodes with no responses (except end nodes)
  nodes.forEach((node) => {
    const callNode = node.data?.callNode as CallNode;
    if (!callNode) return;

    // Skip end and success nodes - they're terminal
    if (callNode.type === "end" || callNode.type === "success") return;

    if (!callNode.responses || callNode.responses.length === 0) {
      errors.push({
        type: "error",
        nodeId: node.id,
        message: `Node "${callNode.title}" has no responses (dead end)`,
      });
    }
  });

  // Check for broken connections (responses pointing to non-existent nodes)
  nodes.forEach((node) => {
    const callNode = node.data?.callNode as CallNode;
    if (!callNode) return;

    callNode.responses?.forEach((response) => {
      if (!nodeIds.has(response.nextNode)) {
        errors.push({
          type: "error",
          nodeId: node.id,
          message: `Response "${response.label}" points to non-existent node "${response.nextNode}"`,
        });
      }
    });
  });

  // Check for circular dependencies (simple cycle detection)
  const detectCycle = (
    startNodeId: string,
    visited = new Set<string>(),
    path = new Set<string>()
  ): string[] | null => {
    if (path.has(startNodeId)) {
      return Array.from(path);
    }

    if (visited.has(startNodeId)) {
      return null;
    }

    visited.add(startNodeId);
    path.add(startNodeId);

    const node = nodes.find((n) => n.id === startNodeId);
    const callNode = node?.data?.callNode as CallNode;

    if (callNode?.responses) {
      for (const response of callNode.responses) {
        const cycle = detectCycle(response.nextNode, visited, new Set(path));
        if (cycle) {
          return cycle;
        }
      }
    }

    path.delete(startNodeId);
    return null;
  };

  const visited = new Set<string>();
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      const cycle = detectCycle(node.id, visited);
      if (cycle) {
        errors.push({
          type: "warning",
          message: `Circular dependency detected: ${cycle.join(" → ")}`,
        });
      }
    }
  });

  // Check if there's at least one opening node
  const openingNodes = nodes.filter(
    (n) => (n.data?.callNode as CallNode)?.type === "opening"
  );
  if (openingNodes.length === 0) {
    errors.push({
      type: "error",
      message: "No opening node found. At least one opening node is required.",
    });
  }

  // Check for nodes with missing required fields
  nodes.forEach((node) => {
    const callNode = node.data?.callNode as CallNode;
    if (!callNode) {
      errors.push({
        type: "error",
        nodeId: node.id,
        message: `Node data is missing or invalid`,
      });
      return;
    }

    if (!callNode.id || !callNode.title || !callNode.script) {
      errors.push({
        type: "error",
        nodeId: node.id,
        message: `Node "${callNode.title || node.id}" is missing required fields (id, title, or script)`,
      });
    }
  });

  return errors;
}

/**
 * Get validation summary
 */
export function getValidationSummary(errors: ValidationError[]): {
  errorCount: number;
  warningCount: number;
  isValid: boolean;
} {
  const errorCount = errors.filter((e) => e.type === "error").length;
  const warningCount = errors.filter((e) => e.type === "warning").length;

  return {
    errorCount,
    warningCount,
    isValid: errorCount === 0,
  };
}
