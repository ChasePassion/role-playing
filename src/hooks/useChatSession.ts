"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/components/ChatMessage";
import type { Character } from "@/components/Sidebar";
import {
    editUserTurnAndStreamReply,
    getChatTurns,
    regenAssistantTurn,
    selectTurnCandidate,
    streamChatMessage,
    type TurnsPageResponse,
} from "@/lib/api";
import { mapCharacterToSidebar } from "@/lib/character-adapter";

interface UseChatSessionArgs {
    chatId: string;
    isAuthed: boolean;
    canSend: boolean;
    setSelectedCharacterId: (id: string | null) => void;
}

interface UseChatSessionResult {
    character: Character | null;
    messages: Message[];
    isStreaming: boolean;
    isLoading: boolean;
    error: string | null;
    handleSelectCandidate: (turnId: string, candidateNo: number) => Promise<void>;
    handleRegenAssistant: (turnId: string) => Promise<void>;
    handleEditUser: (turnId: string, newContent: string) => Promise<void>;
    handleSendMessage: (content: string) => Promise<void>;
}

export function useChatSession({
    chatId,
    isAuthed,
    canSend,
    setSelectedCharacterId,
}: UseChatSessionArgs): UseChatSessionResult {
    const [character, setCharacter] = useState<Character | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const streamAbortRef = useRef<AbortController | null>(null);

    const clearActiveStream = useCallback((controller?: AbortController) => {
        if (!controller || streamAbortRef.current === controller) {
            streamAbortRef.current = null;
        }
    }, []);

    const beginStream = useCallback(() => {
        streamAbortRef.current?.abort();
        const controller = new AbortController();
        streamAbortRef.current = controller;
        return controller;
    }, []);

    const reloadChatTurns = useCallback(async () => {
        if (!chatId || !isAuthed) return;

        setError(null);

        const data: TurnsPageResponse = await getChatTurns(chatId, { limit: 50 });
        const mappedCharacter: Character = mapCharacterToSidebar(data.character);

        setCharacter(mappedCharacter);
        setSelectedCharacterId(data.character.id);

        const mappedMessages: Message[] = data.turns
            .filter((t) => t.author_type === "USER" || t.author_type === "CHARACTER")
            .filter((t) => t.primary_candidate.is_final || t.primary_candidate.content.trim() !== "")
            .map((t) => ({
                id: t.id,
                role: t.author_type === "USER" ? "user" : "assistant",
                content: t.primary_candidate.content,
                isGreeting: t.author_type === "CHARACTER" && t.is_proactive && !t.parent_turn_id,
                candidateNo: t.primary_candidate.candidate_no,
                candidateCount: t.candidate_count,
            }));

        setMessages(mappedMessages);
    }, [chatId, isAuthed, setSelectedCharacterId]);

    useEffect(() => {
        async function loadChat() {
            if (!chatId || !isAuthed) return;

            streamAbortRef.current?.abort();
            streamAbortRef.current = null;
            setIsLoading(true);
            setIsStreaming(false);
            setError(null);
            setCharacter(null);
            setMessages([]);

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
            streamAbortRef.current?.abort();
            streamAbortRef.current = null;
            setSelectedCharacterId(null);
        };
    }, [chatId, isAuthed, reloadChatTurns, setSelectedCharacterId]);

    const handleSelectCandidate = useCallback(
        async (turnId: string, candidateNo: number) => {
            if (isStreaming) return;
            try {
                await selectTurnCandidate(turnId, { candidate_no: candidateNo });
                await reloadChatTurns();
            } catch (err) {
                console.error("Failed to select candidate:", err);
                setError(err instanceof Error ? err.message : "Failed to select candidate");
            }
        },
        [isStreaming, reloadChatTurns]
    );

    const handleRegenAssistant = useCallback(
        async (turnId: string) => {
            if (isStreaming) return;

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

            const controller = beginStream();
            setIsStreaming(true);

            try {
                await regenAssistantTurn(turnId, {
                    signal: controller.signal,
                    onChunk: (chunk) => {
                        if (controller.signal.aborted) return;
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === turnId ? { ...m, content: m.content + chunk } : m
                            )
                        );
                    },
                    onDone: async (fullContent) => {
                        if (controller.signal.aborted) return;
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === turnId ? { ...m, content: fullContent } : m
                            )
                        );
                        setIsStreaming(false);
                        clearActiveStream(controller);
                        await reloadChatTurns();
                    },
                    onError: async (errMsg) => {
                        if (controller.signal.aborted) return;
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === turnId ? { ...m, content: `Error: ${errMsg}` } : m
                            )
                        );
                        setIsStreaming(false);
                        clearActiveStream(controller);
                        await reloadChatTurns();
                    },
                });
            } finally {
                clearActiveStream(controller);
            }
        },
        [beginStream, clearActiveStream, isStreaming, reloadChatTurns]
    );

    const handleEditUser = useCallback(
        async (turnId: string, newContent: string) => {
            if (isStreaming) return;

            const idx = messages.findIndex((m) => m.id === turnId);
            if (idx < 0) return;

            const tempAssistantId = `assistant-edit-${Date.now()}`;

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

            const controller = beginStream();
            setIsStreaming(true);

            try {
                await editUserTurnAndStreamReply(
                    turnId,
                    { content: newContent },
                    {
                        signal: controller.signal,
                        onChunk: (chunk) => {
                            if (controller.signal.aborted) return;
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === tempAssistantId
                                        ? { ...m, content: m.content + chunk }
                                        : m
                                )
                            );
                        },
                        onDone: async (fullContent) => {
                            if (controller.signal.aborted) return;
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === tempAssistantId
                                        ? { ...m, content: fullContent }
                                        : m
                                )
                            );
                            setIsStreaming(false);
                            clearActiveStream(controller);
                            await reloadChatTurns();
                        },
                        onError: async (errMsg) => {
                            if (controller.signal.aborted) return;
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === tempAssistantId
                                        ? { ...m, content: `Error: ${errMsg}` }
                                        : m
                                )
                            );
                            setIsStreaming(false);
                            clearActiveStream(controller);
                            await reloadChatTurns();
                        },
                    }
                );
            } finally {
                clearActiveStream(controller);
            }
        },
        [
            beginStream,
            clearActiveStream,
            isStreaming,
            messages,
            reloadChatTurns,
        ]
    );

    const handleSendMessage = useCallback(
        async (content: string) => {
            if (!character || !canSend || isStreaming) return;

            const tempUserId = `user-${Date.now()}`;
            const tempAssistantId = `assistant-${Date.now()}`;

            const userMessage: Message = {
                id: tempUserId,
                role: "user",
                content,
                isTemp: true,
            };
            setMessages((prev) => [...prev, userMessage]);

            setMessages((prev) => [
                ...prev,
                { id: tempAssistantId, role: "assistant", content: "", isTemp: true },
            ]);

            const controller = beginStream();
            setIsStreaming(true);

            try {
                await streamChatMessage(chatId, { content }, {
                    signal: controller.signal,
                    onMeta: () => {},
                    onChunk: (chunk) => {
                        if (controller.signal.aborted) return;
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === tempAssistantId
                                    ? { ...m, content: m.content + chunk }
                                    : m
                            )
                        );
                    },
                    onDone: async (fullContent) => {
                        if (controller.signal.aborted) return;
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === tempAssistantId
                                    ? { ...m, content: fullContent }
                                    : m
                            )
                        );
                        setIsStreaming(false);
                        clearActiveStream(controller);
                        await reloadChatTurns();
                    },
                    onError: async (streamError) => {
                        if (controller.signal.aborted) return;
                        console.error("Chat error:", streamError);
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === tempAssistantId
                                    ? { ...m, content: `Error: ${streamError}` }
                                    : m
                            )
                        );
                        setIsStreaming(false);
                        clearActiveStream(controller);
                        await reloadChatTurns();
                    },
                });
            } finally {
                clearActiveStream(controller);
            }
        },
        [
            beginStream,
            canSend,
            character,
            chatId,
            clearActiveStream,
            isStreaming,
            reloadChatTurns,
        ]
    );

    return {
        character,
        messages,
        isStreaming,
        isLoading,
        error,
        handleSelectCandidate,
        handleRegenAssistant,
        handleEditUser,
        handleSendMessage,
    };
}
