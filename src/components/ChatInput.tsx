"use client";

import { useState, KeyboardEvent } from "react";

interface ChatInputProps {
    onSend: (message: string) => void;
    disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
    const [message, setMessage] = useState("");

    const handleSend = () => {
        if (message.trim() && !disabled) {
            onSend(message.trim());
            setMessage("");
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="w-[70%] mx-auto">
            <div className="input-container flex items-end gap-2 p-2">
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="发送消息..."
                    disabled={disabled}
                    rows={1}
                    className="flex-1 resize-none bg-transparent px-3 py-2 text-sm text-text-primary placeholder:text-placeholder focus:outline-none min-h-[40px] max-h-[120px]"
                    style={{ scrollbarWidth: "none" }}
                />
                <button
                    onClick={handleSend}
                    disabled={disabled || !message.trim()}
                    className="send-button disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="发送消息"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M8.99992 16V6.41407L5.70696 9.70704C5.31643 10.0976 4.68342 10.0976 4.29289 9.70704C3.90237 9.31652 3.90237 8.6835 4.29289 8.29298L9.29289 3.29298L9.36907 3.22462C9.76184 2.90427 10.3408 2.92686 10.707 3.29298L15.707 8.29298L15.7753 8.36915C16.0957 8.76192 16.0731 9.34092 15.707 9.70704C15.3408 10.0732 14.7618 10.0958 14.3691 9.7754L14.2929 9.70704L10.9999 6.41407V16C10.9999 16.5523 10.5522 17 9.99992 17C9.44764 17 8.99992 16.5523 8.99992 16Z" />
                    </svg>
                </button>
            </div>
        </div>
    );
}
