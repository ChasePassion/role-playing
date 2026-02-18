"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Markdown from "./Markdown";

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
    const refreshIcon = "/icons/refresh-ec66f0.svg";
    const chevronLeftIcon = "/icons/chevron-left-8ee2e9.svg";
    const editIcon = "/icons/edit-6d87e1.svg";
    const branchButtonClass =
        "hover:bg-gray-100 flex h-[30px] w-[24px] items-center justify-center rounded-md text-text-secondary disabled:opacity-50 disabled:hover:bg-transparent";
    const actionButtonClass =
        "text-text-secondary hover:bg-gray-100 flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50 disabled:hover:bg-transparent";
    const isUser = message.role === "user";
    const k = message.candidateNo ?? 1;
    const n = message.candidateCount ?? 1;
    const showNav =
        !message.isTemp &&
        !message.isGreeting &&
        message.candidateNo !== undefined &&
        message.candidateCount !== undefined;
    const [isUserMessageHovering, setIsUserMessageHovering] = useState(false);
    const isActionRowVisible = !isUser || isUserMessageHovering;
    const renderActionIcon = (iconSrc: string, className = "") => (
        <span
            aria-hidden="true"
            className={`inline-block h-5 w-5 shrink-0 ${className}`}
            style={{
                backgroundColor: "#5D5D5D",
                WebkitMaskImage: `url(${iconSrc})`,
                maskImage: `url(${iconSrc})`,
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                maskPosition: "center",
                WebkitMaskSize: "contain",
                maskSize: "contain",
            }}
        />
    );

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
        <div className="relative flex w-full min-w-0 flex-col">
            <div
                className={`flex max-w-full items-start gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
            >
                {/* Avatar */}
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
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

                {/* One message block: bubble + action row */}
                <div
                    className={
                        isUser
                            ? "relative flex w-[70%] min-w-0 flex-col items-end py-[6px]"
                            : "flex min-w-0 max-w-[70%] flex-col"
                    }
                    onMouseEnter={
                        isUser ? () => setIsUserMessageHovering(true) : undefined
                    }
                    onMouseLeave={
                        isUser ? () => setIsUserMessageHovering(false) : undefined
                    }
                >
                    <div
                        className={`w-fit max-w-full px-4 py-2.5 ${isUser ? "bubble-user" : "bubble-assistant"}`}
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
                            <div className="text-sm leading-relaxed">
                                {isUser ? (
                                    <p className="whitespace-pre-wrap">{message.content}</p>
                                ) : (
                                    <Markdown content={message.content} variant="assistant" />
                                )}
                            </div>
                        )}
                    </div>

                    {showNav && (
                        <div
                            className={`mt-1 flex h-8 w-full items-center gap-1 ${isUser ? "justify-end transition-opacity duration-200 ease-out" : "justify-start"} ${isUser && !isActionRowVisible ? "pointer-events-none opacity-0" : "opacity-100"}`}
                        >
                            <div className="flex items-center justify-center text-text-secondary">
                                <button
                                    type="button"
                                    className={branchButtonClass}
                                    onClick={handleLeft}
                                    disabled={disabled || k <= 1}
                                    aria-label="上一分支"
                                >
                                    {renderActionIcon(chevronLeftIcon)}
                                </button>
                                <div className="px-0.5 text-sm font-semibold tabular-nums text-text-secondary">
                                    {k}/{n}
                                </div>
                                <button
                                    type="button"
                                    className={branchButtonClass}
                                    onClick={handleRight}
                                    disabled={
                                        disabled ||
                                        (k >= n && (message.role !== "assistant" || n >= 10))
                                    }
                                    aria-label="下一分支"
                                >
                                    {renderActionIcon(chevronLeftIcon, "rotate-180")}
                                </button>
                            </div>

                            {message.role === "assistant" && (
                                <button
                                    type="button"
                                    className={actionButtonClass}
                                    onClick={handleRegen}
                                    disabled={disabled || n >= 10}
                                    aria-label="重新生成"
                                >
                                    {renderActionIcon(refreshIcon)}
                                </button>
                            )}

                            {message.role === "user" && (
                                <button
                                    type="button"
                                    className={actionButtonClass}
                                    onClick={handleEdit}
                                    disabled={disabled || n >= 10}
                                    aria-label="编辑"
                                >
                                    {renderActionIcon(editIcon)}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
