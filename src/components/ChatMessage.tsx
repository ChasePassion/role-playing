"use client";

import Image from "next/image";

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
}

interface ChatMessageProps {
    message: Message;
    userAvatar: string;
    assistantAvatar: string;
}

export default function ChatMessage({
    message,
    userAvatar,
    assistantAvatar,
}: ChatMessageProps) {
    const isUser = message.role === "user";

    return (
        <div
            className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
        >
            {/* Avatar */}
            <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0">
                {isUser ? (
                    <div className="w-full h-full bg-user-bubble flex items-center justify-center">
                        <Image
                            src={userAvatar}
                            alt="User"
                            width={20}
                            height={20}
                            className="text-white"
                            style={{ filter: "brightness(0) invert(1)" }}
                        />
                    </div>
                ) : (
                    <Image
                        src={assistantAvatar}
                        alt="Assistant"
                        fill
                        className="object-cover"
                    />
                )}
            </div>

            {/* Message bubble */}
            <div
                className={`max-w-[70%] px-4 py-2.5 ${isUser ? "bubble-user" : "bubble-assistant"
                    }`}
            >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                </p>
            </div>
        </div>
    );
}
