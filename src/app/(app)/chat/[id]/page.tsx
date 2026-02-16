"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
    getChatTurns,
    streamChatMessage,
    selectTurnCandidate,
    regenAssistantTurn,
    editUserTurnAndStreamReply,
    TurnsPageResponse,
} from "@/lib/api";
import ChatHeader from "@/components/ChatHeader";
import ChatMessage, { Message } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import { Character } from "@/components/Sidebar";
import { useSidebar } from "../../layout";

export default function ChatPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isAuthed } = useAuth();
    const { setSelectedCharacterId } = useSidebar();

    const chatId = params.id as string;

    const [character, setCharacter] = useState<Character | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const reloadChatTurns = async () => {
        if (!chatId || !isAuthed) return;

        setError(null);

        const data: TurnsPageResponse = await getChatTurns(chatId, { limit: 50 });

        const c = data.character;
        const mappedCharacter: Character = {
            id: c.id,
            name: c.name,
            description: c.description,
            avatar: c.avatar_file_name ? `${c.avatar_file_name}` : "/default-avatar.svg",
            greeting_message: c.greeting_message,
            tags: c.tags,
            visibility: c.visibility,
            creator_id: c.creator_id ?? undefined,
        };

        setCharacter(mappedCharacter);
        setSelectedCharacterId(c.id);

        const mappedMessages: Message[] = data.turns
            .filter((t) => t.author_type === "USER" || t.author_type === "CHARACTER")
            .filter((t) => t.primary_candidate.is_final || t.primary_candidate.content.trim() !== "")
            .map((t) => ({
                id: t.id,
                role: t.author_type === "USER" ? "user" : "assistant",
                content: t.primary_candidate.content,
                candidateNo: t.primary_candidate.candidate_no,
                candidateCount: t.candidate_count,
            }));

        setMessages(mappedMessages);
    };

    // Load chat (character + turns)
    useEffect(() => {
        async function loadChat() {
            if (!chatId || !isAuthed) return;

            setIsLoading(true);
            setError(null);

            try {
                await reloadChatTurns();
            } catch (err) {
                console.error("Failed to load chat:", err);
                setError(err instanceof Error ? err.message : "Failed to load chat");
            } finally {
                setIsLoading(false);
            }
        }

        loadChat();

        return () => {
            setSelectedCharacterId(null);
        };
    }, [chatId, isAuthed, setSelectedCharacterId]);

    const handleSelectCandidate = async (turnId: string, candidateNo: number) => {
        if (isStreaming) return;
        try {
            await selectTurnCandidate(turnId, { candidate_no: candidateNo });
            await reloadChatTurns();
        } catch (err) {
            console.error("Failed to select candidate:", err);
            setError(err instanceof Error ? err.message : "Failed to select candidate");
        }
    };

    const handleRegenAssistant = async (turnId: string) => {
        if (isStreaming) return;

        // Optimistic: clear content + move to the new candidate slot.
        setMessages((prev) =>
            prev.map((m) => {
                if (m.id !== turnId) return m;
                const nextCount = Math.min(10, (m.candidateCount ?? 1) + 1);
                return {
                    ...m,
                    content: "",
                    candidateNo: nextCount,
                    candidateCount: nextCount,
                };
            })
        );

        setIsStreaming(true);

        await regenAssistantTurn(turnId, {
            onChunk: (chunk) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === turnId ? { ...m, content: m.content + chunk } : m
                    )
                );
            },
            onDone: async (fullContent) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === turnId ? { ...m, content: fullContent } : m
                    )
                );
                setIsStreaming(false);
                await reloadChatTurns();
            },
            onError: async (errMsg) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === turnId ? { ...m, content: `Error: ${errMsg}` } : m
                    )
                );
                setIsStreaming(false);
                await reloadChatTurns();
            },
        });
    };

    const handleEditUser = async (turnId: string, newContent: string) => {
        if (isStreaming) return;

        const idx = messages.findIndex((m) => m.id === turnId);
        if (idx < 0) return;

        const tempAssistantId = `assistant-edit-${Date.now()}`;

        // Optimistic: update user content, truncate later turns (branch changes), and insert streaming assistant.
        setMessages((prev) => {
            const next = prev.slice(0, idx + 1).map((m) => {
                if (m.id !== turnId) return m;
                const nextCount = Math.min(10, (m.candidateCount ?? 1) + 1);
                return {
                    ...m,
                    content: newContent,
                    candidateNo: nextCount,
                    candidateCount: nextCount,
                };
            });
            next.push({ id: tempAssistantId, role: "assistant", content: "", isTemp: true });
            return next;
        });

        setIsStreaming(true);

        await editUserTurnAndStreamReply(
            turnId,
            { content: newContent },
            {
                onChunk: (chunk) => {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === tempAssistantId
                                ? { ...m, content: m.content + chunk }
                                : m
                        )
                    );
                },
                onDone: async (fullContent) => {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === tempAssistantId
                                ? { ...m, content: fullContent }
                                : m
                        )
                    );
                    setIsStreaming(false);
                    await reloadChatTurns();
                },
                onError: async (errMsg) => {
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === tempAssistantId
                                ? { ...m, content: `Error: ${errMsg}` }
                                : m
                        )
                    );
                    setIsStreaming(false);
                    await reloadChatTurns();
                },
            }
        );
    };

    const handleSendMessage = async (content: string) => {
        if (!character || !user || isStreaming) return;

        const tempUserId = `user-${Date.now()}`;
        const tempAssistantId = `assistant-${Date.now()}`;

        // Add user message
        const userMessage: Message = {
            id: tempUserId,
            role: "user",
            content,
            isTemp: true,
        };
        setMessages((prev) => [...prev, userMessage]);

        // Prepare streaming assistant message
        setMessages((prev) => [
            ...prev,
            { id: tempAssistantId, role: "assistant", content: "", isTemp: true },
        ]);

        setIsStreaming(true);

        await streamChatMessage(chatId, { content }, {
            onMeta: () => {
                // Server turn IDs are available here if/when we want to persist optimistic UI anchors.
            },
            onChunk: (chunk) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === tempAssistantId
                            ? { ...m, content: m.content + chunk }
                            : m
                    )
                );
            },
            onDone: (fullContent) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === tempAssistantId
                            ? { ...m, content: fullContent }
                            : m
                    )
                );
                setIsStreaming(false);
                reloadChatTurns();
            },
            onError: (error) => {
                console.error("Chat error:", error);
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === tempAssistantId
                            ? { ...m, content: `Error: ${error}` }
                            : m
                    )
                );
                setIsStreaming(false);
                reloadChatTurns();
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !character) {
        return (
            <div className="flex-1 flex items-center justify-center bg-white">
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
            {/* Chat Header */}
            <ChatHeader character={character} />

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map((message) => (
                        <ChatMessage
                            key={message.id}
                            message={message}
                            userAvatar={user?.avatar_url || "/default-avatar.svg"}
                            assistantAvatar={character.avatar}
                            disabled={isStreaming}
                            onSelectCandidate={handleSelectCandidate}
                            onRegenAssistant={handleRegenAssistant}
                            onEditUser={handleEditUser}
                        />
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Input Area */}
            <div className="border-t border-divider bg-white py-4">
                <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
            </div>
        </>
    );
}
