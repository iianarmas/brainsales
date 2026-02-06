import { useEffect, useRef, memo } from 'react';
import { useReactFlow } from '@xyflow/react';

interface UseSelectionAutoPanOptions {
    /**
     * Distance from viewport edge (in pixels) to trigger auto-pan
     * @default 50
     */
    edgeThreshold?: number;

    /**
     * Maximum pan speed (in pixels per frame)
     * @default 10
     */
    maxSpeed?: number;

    /**
     * Whether auto-pan is enabled
     * @default true
     */
    enabled?: boolean;
}

/**
 * Hook to enable auto-panning during box selection (Shift+Drag)
 * This allows users to select nodes outside the current viewport
 */
export function useSelectionAutoPan({
    edgeThreshold = 50,
    maxSpeed = 10,
    enabled = true,
}: UseSelectionAutoPanOptions = {}) {
    const { getViewport, setViewport } = useReactFlow();
    const animationFrameRef = useRef<number | null>(null);
    const isSelectingRef = useRef(false);
    const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
    const viewportSizeRef = useRef<{ width: number; height: number } | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const handleMouseDown = (e: MouseEvent) => {
            // Only track selection if Shift key is pressed
            if (e.shiftKey) {
                isSelectingRef.current = true;
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            if (!isSelectingRef.current) return;

            // Get the React Flow container bounds
            const flowContainer = document.querySelector('.react-flow');
            if (!flowContainer) return;

            const rect = flowContainer.getBoundingClientRect();
            viewportSizeRef.current = {
                width: rect.width,
                height: rect.height,
            };

            // Store mouse position relative to the viewport
            mousePositionRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };
        };

        const handleMouseUp = () => {
            isSelectingRef.current = false;
            mousePositionRef.current = null;
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };

        // Add event listeners
        document.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [enabled]);

    // Auto-pan loop
    useEffect(() => {
        if (!enabled) return;

        const autoPan = () => {
            if (!isSelectingRef.current || !mousePositionRef.current || !viewportSizeRef.current) {
                animationFrameRef.current = requestAnimationFrame(autoPan);
                return;
            }

            const { x: mouseX, y: mouseY } = mousePositionRef.current;
            const { width, height } = viewportSizeRef.current;

            let panX = 0;
            let panY = 0;

            // Calculate pan speed based on distance from edge
            // Left edge
            if (mouseX < edgeThreshold) {
                const ratio = 1 - mouseX / edgeThreshold;
                panX = ratio * maxSpeed;
            }
            // Right edge
            else if (mouseX > width - edgeThreshold) {
                const ratio = (mouseX - (width - edgeThreshold)) / edgeThreshold;
                panX = -ratio * maxSpeed;
            }

            // Top edge
            if (mouseY < edgeThreshold) {
                const ratio = 1 - mouseY / edgeThreshold;
                panY = ratio * maxSpeed;
            }
            // Bottom edge
            else if (mouseY > height - edgeThreshold) {
                const ratio = (mouseY - (height - edgeThreshold)) / edgeThreshold;
                panY = -ratio * maxSpeed;
            }

            // Apply pan if needed
            if (panX !== 0 || panY !== 0) {
                const viewport = getViewport();
                setViewport({
                    x: viewport.x + panX,
                    y: viewport.y + panY,
                    zoom: viewport.zoom,
                }, { duration: 0 });
            }

            animationFrameRef.current = requestAnimationFrame(autoPan);
        };

        animationFrameRef.current = requestAnimationFrame(autoPan);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [enabled, edgeThreshold, maxSpeed, getViewport, setViewport]);
}

/**
 * Component wrapper for useSelectionAutoPan hook.
 * Must be rendered as a child of ReactFlow to access the flow context.
 */
export const SelectionAutoPan = memo(function SelectionAutoPan({
    edgeThreshold = 50,
    maxSpeed = 10,
    enabled = true,
}: UseSelectionAutoPanOptions) {
    useSelectionAutoPan({ edgeThreshold, maxSpeed, enabled });
    return null;
});
