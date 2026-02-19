"use client";

import type { RefObject } from "react";
import { useRouter } from "next/navigation";
import ChatMessage, { type Message } from "@/components/ChatMessage";
import type { Character } from "@/components/Sidebar";
import { useUserSettings } from "@/lib/user-settings-context";

interface ChatThreadProps {
    character: Character | null;
    messages: Message[];
    isLoading: boolean;
    error: string | null;
    isStreaming: boolean;
    userAvatar: string;
    messagesEndRef: RefObject<HTMLDivElement | null>;
    onSelectCandidate: (turnId: string, candidateNo: number) => void;
    onRegenAssistant: (turnId: string) => void;
    onEditUser: (turnId: string, newContent: string) => void;
}

export default function ChatThread({
    character,
    messages,
    isLoading,
    error,
    isStreaming,
    userAvatar,
    messagesEndRef,
    onSelectCandidate,
    onRegenAssistant,
    onEditUser,
}: ChatThreadProps) {
    const router = useRouter();
    const { messageFontSize } = useUserSettings();

    if (isLoading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !character) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error || "Chat not found"}</p>
                    <button
                        onClick={() => router.push("/")}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        返回首页
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {messages.map((message, index) => {
                const isUserTurn = message.role === "user";
                const isLastTurn = index === messages.length - 1;

                return (
                    <article
                        key={message.id}
                        className={
                            isUserTurn
                                ? "text-token-text-primary w-full focus:outline-none [--shadow-height:45px] scroll-mt-(--header-height)"
                                : "text-token-text-primary w-full focus:outline-none [--shadow-height:45px] [content-visibility:auto] supports-[content-visibility:auto]:[contain-intrinsic-size:auto_100lvh] scroll-mt-[calc(var(--header-height)+min(200px,max(70px,20svh)))]"
                        }
                        tabIndex={-1}
                        dir="auto"
                        data-turn-id={message.id}
                        data-testid={`conversation-turn-${index + 1}`}
                        data-scroll-anchor={isLastTurn ? "true" : "false"}
                        data-turn={message.role}
                    >
                        {isUserTurn ? (
                            <h5 className="sr-only">You said:</h5>
                        ) : (
                            <h6 className="sr-only">ChatGPT said:</h6>
                        )}
                        <div
                            className={`text-base my-auto mx-auto px-3 sm:px-4 lg:px-0 ${
                                isUserTurn ? "pt-3" : ""
                            }`}
                        >
                            <div
                                className={`mx-auto w-full max-w-[44rem] lg:max-w-[calc(100%-320px)] flex-1 group/turn-messages focus-visible:outline-hidden relative flex min-w-0 flex-col ${
                                    isUserTurn ? "" : "agent-turn"
                                }`}
                                tabIndex={-1}
                            >
                                <div className="flex max-w-full flex-col grow">
                                    <div
                                        data-message-author-role={isUserTurn ? "user" : "assistant"}
                                        data-message-id={message.id}
                                        dir="auto"
                                        className="min-h-8 text-message relative flex w-full flex-col items-end gap-2 text-start break-words whitespace-normal [.text-message+&]:mt-1"
                                    >
                                        <ChatMessage
                                            message={message}
                                            userAvatar={userAvatar}
                                            assistantAvatar={character.avatar}
                                            messageFontSize={messageFontSize}
                                            disabled={isStreaming}
                                            onSelectCandidate={onSelectCandidate}
                                            onRegenAssistant={onRegenAssistant}
                                            onEditUser={onEditUser}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <span className="sr-only">
                            <br />
                        </span>
                    </article>
                );
            })}
            <div ref={messagesEndRef} />
        </>
    );
}
