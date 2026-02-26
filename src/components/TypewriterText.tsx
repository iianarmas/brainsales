"use client";

import { useState, useEffect, useRef } from "react";

interface TypewriterTextProps {
    text: string;
    nodeId?: string; // Stable ID to prevent reset on minor text changes
    speed?: number; // ms per character
    className?: string;
}

export function TypewriterText({ text, nodeId, speed = 15, className = "" }: TypewriterTextProps) {
    const [displayedText, setDisplayedText] = useState("");
    const [isTyping, setIsTyping] = useState(true);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastNodeIdRef = useRef<string | undefined>("");
    const textRef = useRef(text);

    // Always keep textRef updated so interval uses latest content
    useEffect(() => {
        textRef.current = text;
        // If we finished typing and the text changed slightly (e.g. placeholder),
        // update the display immediately without restarting animation.
        if (!isTyping) {
            setDisplayedText(text);
        }
    }, [text, isTyping]);

    // Reset loop only when node changes or speed changes
    useEffect(() => {
        const isNewNode = nodeId !== lastNodeIdRef.current;
        lastNodeIdRef.current = nodeId;

        if (isNewNode) {
            setDisplayedText("");
            setIsTyping(true);
        } else if (!isTyping) {
            // If it's the same node and we're done typing, just bail
            return;
        }

        if (!text) {
            setIsTyping(false);
            return;
        }

        let i = isNewNode ? 0 : displayedText.length;

        // Clear any existing interval
        if (intervalRef.current) clearInterval(intervalRef.current);

        intervalRef.current = setInterval(() => {
            const currentText = textRef.current;
            setDisplayedText(currentText.slice(0, i + 1));
            i++;

            if (i >= currentText.length) {
                if (intervalRef.current) clearInterval(intervalRef.current);
                setIsTyping(false);
            }
        }, speed);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [nodeId, speed]); // Note: excluding 'text' from here to prevent restart

    const handleSkip = () => {
        if (isTyping) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setDisplayedText(text);
            setIsTyping(false);
        }
    };

    return (
        <div
            className={`cursor-pointer ${className}`}
            onClick={handleSkip}
            title={isTyping ? "Click to reveal all full text instantly" : ""}
        >
            <span>{displayedText}</span>
            {isTyping && (
                <span
                    className="inline-block w-[0.4em] h-[1em] bg-current ml-1 align-middle animate-pulse opacity-70"
                    style={{ marginBottom: '-0.1em' }}
                />
            )}
        </div>
    );
}
