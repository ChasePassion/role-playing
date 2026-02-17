"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    candidateNo?: number;
    candidateCount?: number;
    isTemp?: boolean;
    isGreeting?: boolean;
}

interface ChatMessageProps {
    message: Message;
    userAvatar: string;
    assistantAvatar: string;
    disabled?: boolean;
    onSelectCandidate?: (turnId: string, candidateNo: number) => void;
    onRegenAssistant?: (turnId: string) => void;
    onEditUser?: (turnId: string, newContent: string) => void;
}

export default function ChatMessage({
    message,
    userAvatar,
    assistantAvatar,
    disabled = false,
    onSelectCandidate,
    onRegenAssistant,
    onEditUser,
}: ChatMessageProps) {
    const isUser = message.role === "user";
    const k = message.candidateNo ?? 1;
    const n = message.candidateCount ?? 1;
    const showNav =
        !message.isTemp &&
        !message.isGreeting &&
        message.candidateNo !== undefined &&
        message.candidateCount !== undefined;

    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(message.content);

    useEffect(() => {
        if (!isEditing) setDraft(message.content);
    }, [message.content, isEditing]);

    const handleLeft = () => {
        if (disabled) return;
        if (!showNav) return;
        if (!onSelectCandidate) return;
        if (k <= 1) return;
        onSelectCandidate(message.id, k - 1);
    };

    const handleRight = () => {
        if (disabled) return;
        if (!showNav) return;
        if (k < n) {
            onSelectCandidate?.(message.id, k + 1);
            return;
        }
        if (message.role === "assistant" && n < 10) {
            onRegenAssistant?.(message.id);
        }
    };

    const handleRegen = () => {
        if (disabled) return;
        if (message.role !== "assistant") return;
        if (!showNav) return;
        if (n >= 10) return;
        onRegenAssistant?.(message.id);
    };

    const handleEdit = () => {
        if (disabled) return;
        if (message.role !== "user") return;
        if (!showNav) return;
        if (n >= 10) return;
        setIsEditing(true);
    };

    const handleEditCancel = () => {
        setIsEditing(false);
        setDraft(message.content);
    };

    const handleEditSend = () => {
        if (disabled) return;
        const next = draft.trim();
        if (!next) return;
        onEditUser?.(message.id, next);
        setIsEditing(false);
    };

    return (
        <div
            className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
        >
            {/* Avatar */}
            <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0">
                {isUser ? (
                    <Image
                        src={userAvatar}
                        alt="User"
                        fill
                        className="object-cover"
                    />
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
            <div className="max-w-[70%]">
                <div
                    className={`px-4 py-2.5 ${isUser ? "bubble-user" : "bubble-assistant"}`}
                >
                    {isEditing ? (
                        <div className="space-y-2">
                            <textarea
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                rows={3}
                                className="w-full resize-none bg-transparent text-sm leading-relaxed whitespace-pre-wrap focus:outline-none"
                                disabled={disabled}
                            />
                            <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
                                <button
                                    type="button"
                                    className="text-xs px-2 py-1 rounded border border-divider text-text-secondary hover:bg-gray-50 disabled:opacity-50"
                                    onClick={handleEditCancel}
                                    disabled={disabled}
                                >
                                    取消
                                </button>
                                <button
                                    type="button"
                                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                    onClick={handleEditSend}
                                    disabled={disabled || !draft.trim()}
                                >
                                    发送
                                </button>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                        </p>
                    )}
                </div>

                {showNav && (
                    <div className={`mt-1 flex items-center gap-2 text-xs ${isUser ? "justify-end" : "justify-start"}`}>
                        <button
                            type="button"
                            className="px-2 py-1 rounded border border-divider text-text-secondary hover:bg-gray-50 disabled:opacity-50"
                            onClick={handleLeft}
                            disabled={disabled || k <= 1}
                            aria-label="上一分支"
                        >
                            ←
                        </button>
                        <span className="text-text-secondary tabular-nums">{k}/{n}</span>
                        <button
                            type="button"
                            className="px-2 py-1 rounded border border-divider text-text-secondary hover:bg-gray-50 disabled:opacity-50"
                            onClick={handleRight}
                            disabled={
                                disabled ||
                                (k >= n && (message.role !== "assistant" || n >= 10))
                            }
                            aria-label="下一分支"
                        >
                            →
                        </button>

                        {message.role === "assistant" && (
                            <button
                                type="button"
                                className="px-2 py-1 rounded border border-divider text-text-secondary hover:bg-gray-50 disabled:opacity-50"
                                onClick={handleRegen}
                                disabled={disabled || n >= 10}
                                aria-label="重新生成"
                            >
                                regen
                            </button>
                        )}

                        {message.role === "user" && (
                            <button
                                type="button"
                                className="px-2 py-1 rounded border border-divider text-text-secondary hover:bg-gray-50 disabled:opacity-50"
                                onClick={handleEdit}
                                disabled={disabled || n >= 10}
                                aria-label="编辑"
                            >
                                edit
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
