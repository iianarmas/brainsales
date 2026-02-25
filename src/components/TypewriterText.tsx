"use client";

import { useState, useEffect } from "react";

interface TypewriterTextProps {
    text: string;
    speed?: number; // ms per character
    className?: string;
}

export function TypewriterText({ text, speed = 15, className = "" }: TypewriterTextProps) {
    const [displayedText, setDisplayedText] = useState("");
    const [isTyping, setIsTyping] = useState(true);

    const intervalRef = useState<{ id: NodeJS.Timeout | null }>({ id: null })[0];

    // Reset when text changes (i.e. node changes)
    useEffect(() => {
        setDisplayedText("");
        setIsTyping(true);

        if (!text) {
            setIsTyping(false);
            return;
        }

        let i = 0;
        intervalRef.id = setInterval(() => {
            setDisplayedText(text.slice(0, i + 1));
            i++;

            if (i >= text.length) {
                if (intervalRef.id) clearInterval(intervalRef.id);
                setIsTyping(false);
            }
        }, speed);

        return () => {
            if (intervalRef.id) clearInterval(intervalRef.id);
        };
    }, [text, speed, intervalRef]);

    const handleSkip = () => {
        if (isTyping) {
            if (intervalRef.id) clearInterval(intervalRef.id);
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
