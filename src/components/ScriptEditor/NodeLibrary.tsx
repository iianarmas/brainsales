import React, { useState } from "react";
import { ChevronRight, ChevronLeft, GripVertical, Plus } from "lucide-react";

interface NodeTypeOption {
    type: string;
    label: string;
    description: string;
    color: string;
}

const NODE_TYPES: NodeTypeOption[] = [
    {
        type: "opening",
        label: "Opening",
        description: "Start of the conversation/intro",
        color: "bg-green-500",
    },
    {
        type: "discovery",
        label: "Discovery",
        description: "Questions to understand needs",
        color: "bg-blue-500",
    },
    {
        type: "pitch",
        label: "Pitch",
        description: "Presenting the value proposition",
        color: "bg-yellow-500",
    },
    {
        type: "objection",
        label: "Objection",
        description: "Handling common concerns",
        color: "bg-red-500",
    },
    {
        type: "close",
        label: "Close",
        description: "Asking for the commitment",
        color: "bg-gray-500",
    },
];

export default function NodeLibrary() {
    const [isOpen, setIsOpen] = useState(true);

    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData("application/reactflow", nodeType);
        event.dataTransfer.effectAllowed = "move";
    };

    return (
        <div
            className={`bg-background border-r border-primary-light/20 shadow-lg backdrop-blur transition-all duration-300 ease-in-out relative z-10 flex flex-col ${isOpen ? "w-[240px]" : "w-0"
                }`}
        >
            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="absolute -right-6 top-4 bg-primary text-white cursor-pointer p-1 rounded-r-md hover:bg-primary-light transition-colors shadow-sm"
                title={isOpen ? "Close Library" : "Open Library"}
            >
                {isOpen ? (
                    <ChevronLeft className="h-4 w-4" />
                ) : (
                    <ChevronRight className="h-4 w-4" />
                )}
            </button>

            {/* Content */}
            <div
                className={`overflow-hidden h-full flex flex-col ${!isOpen ? "invisible" : ""
                    }`}
            >
                <div className="p-4 bg-primary-light text-white border-b border-primary-light/20">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Components
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                        Drag items to the canvas
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {NODE_TYPES.map((node) => (
                        <div
                            key={node.type}
                            onDragStart={(event) => onDragStart(event, node.type)}
                            draggable
                            className="group flex items-start gap-3 p-3 bg-white/40 border border-primary-light/20 rounded-sm cursor-grab hover:bg-muted hover:border-primary/50 transition-colors active:cursor-grabbing shadow-sm"
                        >
                            <div className={`mt-1 h-3 w-3 rounded-full ${node.color} shrink-0`} />
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm leading-none mb-1">
                                    {node.label}
                                </p>
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                    {node.description}
                                </p>
                            </div>
                            <GripVertical className="h-4 w-4 text-primary opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
