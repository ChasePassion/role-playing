"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getCharacterById, sendChatMessage, CharacterResponse, ChatRequest } from "@/lib/api";
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

    const characterId = params.id as string;

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

    // Set selected character in sidebar
    useEffect(() => {
        if (characterId) {
            setSelectedCharacterId(characterId);
        }
        return () => {
            setSelectedCharacterId(null);
        };
    }, [characterId, setSelectedCharacterId]);

    // Load character
    useEffect(() => {
        async function loadCharacter() {
            if (!characterId || !isAuthed) return;

            setIsLoading(true);
            setError(null);

            try {
                const data: CharacterResponse = await getCharacterById(characterId);

                const mappedCharacter: Character = {
                    id: data.id,
                    name: data.name,
                    description: data.description,
                    avatar: data.avatar_file_name ? `${data.avatar_file_name}` : "/default-avatar.svg",
                    system_prompt: data.system_prompt,
                    greeting_message: data.greeting_message,
                    tags: data.tags,
                    visibility: data.visibility,
                    creator_id: data.creator_id,
                };

                setCharacter(mappedCharacter);

                // Add greeting message if exists
                if (data.greeting_message) {
                    setMessages([
                        {
                            id: "greeting",
                            role: "assistant",
                            content: data.greeting_message,
                        },
                    ]);
                }
            } catch (err) {
                console.error("Failed to load character:", err);
                setError(err instanceof Error ? err.message : "Failed to load character");
            } finally {
                setIsLoading(false);
            }
        }

        loadCharacter();
    }, [characterId, isAuthed]);

    const handleSendMessage = async (content: string) => {
        if (!character || !user || isStreaming) return;

        // Add user message
        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: "user",
            content,
        };
        setMessages((prev) => [...prev, userMessage]);

        // Prepare streaming assistant message
        const assistantMessageId = `assistant-${Date.now()}`;
        setMessages((prev) => [
            ...prev,
            { id: assistantMessageId, role: "assistant", content: "" },
        ]);

        setIsStreaming(true);

        // Build history for API
        const history = messages.map((m) => ({
            role: m.role,
            content: m.content,
        }));

        const request: ChatRequest = {
            user_id: user.id,
            character_id: characterId,
            chat_id: characterId, // Using characterId as chat_id for now
            message: content,
            history,
        };


        await sendChatMessage(
            request,
            // onChunk - update assistant message incrementally
            (chunk) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessageId
                            ? { ...m, content: m.content + chunk }
                            : m
                    )
                );
            },
            // onDone - finalize message
            (fullContent) => {
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessageId
                            ? { ...m, content: fullContent }
                            : m
                    )
                );
                setIsStreaming(false);
            },
            // onError
            (error) => {
                console.error("Chat error:", error);
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantMessageId
                            ? { ...m, content: `Error: ${error}` }
                            : m
                    )
                );
                setIsStreaming(false);
            }
        );
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
                    <p className="text-red-500 mb-4">{error || "Character not found"}</p>
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
