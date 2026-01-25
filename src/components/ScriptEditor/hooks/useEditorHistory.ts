import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export interface HistoryCommand {
    name: string;
    undo: () => Promise<void> | void;
    redo: () => Promise<void> | void;
}

export function useEditorHistory() {
    const [past, setPast] = useState<HistoryCommand[]>([]);
    const [future, setFuture] = useState<HistoryCommand[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);

    const canUndo = past.length > 0;
    const canRedo = future.length > 0;

    const execute = useCallback(async (command: HistoryCommand) => {
        setIsExecuting(true);
        try {
            await command.redo();
            setPast((prev) => [...prev, command]);
            setFuture([]); // Clear future on new action
        } catch (error) {
            console.error(`Failed to execute command ${command.name}:`, error);
            toast.error(`Failed to ${command.name}`);
        } finally {
            setIsExecuting(false);
        }
    }, []);

    const undo = useCallback(async () => {
        if (past.length === 0) return;

        const command = past[past.length - 1];
        setIsExecuting(true);
        try {
            await command.undo();
            setPast((prev) => prev.slice(0, -1));
            setFuture((prev) => [command, ...prev]);
            toast.success(`Undid: ${command.name}`);
        } catch (error) {
            console.error(`Failed to undo ${command.name}:`, error);
            toast.error(`Failed to undo ${command.name}`);
        } finally {
            setIsExecuting(false);
        }
    }, [past]);

    const redo = useCallback(async () => {
        if (future.length === 0) return;

        const command = future[0];
        setIsExecuting(true);
        try {
            await command.redo();
            setFuture((prev) => prev.slice(1));
            setPast((prev) => [...prev, command]);
            toast.success(`Redid: ${command.name}`);
        } catch (error) {
            console.error(`Failed to redo ${command.name}:`, error);
            toast.error(`Failed to redo ${command.name}`);
        } finally {
            setIsExecuting(false);
        }
    }, [future]);

    return {
        past,
        future,
        execute,
        undo,
        redo,
        canUndo,
        canRedo,
        isExecuting
    };
}
