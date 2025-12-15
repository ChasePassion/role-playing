"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth, isProfileComplete } from "@/lib/auth-context";
import { getCharacterById, getMarketCharacters, sendChatMessage, CharacterResponse, ChatRequest } from "@/lib/api";
import ChatHeader from "@/components/ChatHeader";
import ChatMessage, { Message } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import Sidebar, { Character, SidebarToggleIcon } from "@/components/Sidebar";

export default function ChatPage() {
    const params = useParams();
    const router = useRouter();
    const { user, isLoading: isAuthLoading } = useAuth();

    const characterId = params.characterId as string;

    const [character, setCharacter] = useState<Character | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Sidebar characters state
    const [sidebarCharacters, setSidebarCharacters] = useState<Character[]>([]);

    // Sidebar state
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isOverlay, setIsOverlay] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Auth check
    useEffect(() => {
        if (!isAuthLoading) {
            if (!user) {
                router.push("/login");
            } else if (!isProfileComplete(user)) {
                router.push("/setup");
            }
        }
    }, [user, isAuthLoading, router]);

    // Load character
    useEffect(() => {
        async function loadCharacter() {
            if (!characterId || !user) return;

            setIsLoading(true);
            setError(null);

            try {
                const token = localStorage.getItem("access_token");
                const data: CharacterResponse = await getCharacterById(characterId, token || undefined);

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
    }, [characterId, user]);

    // Load sidebar characters
    useEffect(() => {
        async function loadSidebarCharacters() {
            if (!user) return;
            try {
                const apiCharacters = await getMarketCharacters();
                const mapped: Character[] = apiCharacters.map((c: CharacterResponse) => ({
                    id: c.id,
                    name: c.name,
                    description: c.description,
                    avatar: c.avatar_file_name ? `${c.avatar_file_name}` : "/default-avatar.svg",
                    system_prompt: c.system_prompt,
                    tags: c.tags,
                    visibility: c.visibility,
                    creator_id: c.creator_id,
                }));
                setSidebarCharacters(mapped);
            } catch (err) {
                console.error("Failed to load sidebar characters:", err);
            }
        }
        loadSidebarCharacters();
    }, [user]);

    // Handle resize for sidebar
    useEffect(() => {
        const handleResize = () => {
            if (isSidebarOpen && window.innerWidth < 800) {
                setIsSidebarOpen(false);
            }
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [isSidebarOpen]);

    const handleToggleSidebar = () => {
        if (isSidebarOpen) {
            setIsSidebarOpen(false);
        } else {
            const shouldOverlay = window.innerWidth < 800;
            setIsOverlay(shouldOverlay);
            setIsSidebarOpen(true);
        }
    };

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

    if (isAuthLoading || !user) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !character) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
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
        <div className="flex h-screen overflow-hidden relative">
            {/* Overlay background */}
            {isSidebarOpen && isOverlay && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar Wrapper */}
            <div
                className={`
                    shrink-0 transition-all duration-300 ease-in-out h-full overflow-hidden
                    ${isOverlay ? "fixed left-0 top-0 z-50" : "relative"}
                    ${isSidebarOpen ? "w-64" : "w-0"}
                `}
            >
                <Sidebar
                    characters={sidebarCharacters}
                    selectedCharacterId={character.id}
                    onSelectCharacter={(c) => router.push(`/chat/${c.id}`)}
                    onToggle={handleToggleSidebar}
                />
            </div>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col bg-white overflow-hidden">
                {/* Toggle Button */}
                {!isSidebarOpen && (
                    <button
                        onClick={handleToggleSidebar}
                        className="absolute top-4 left-4 z-30 p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                        aria-label="Open Sidebar"
                    >
                        <SidebarToggleIcon className="w-5 h-5" />
                    </button>
                )}

                {/* Chat Header */}
                <ChatHeader character={character} />

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <div className="max-w-3xl mx-auto space-y-6">
                        {messages.map((message) => (
                            <ChatMessage
                                key={message.id}
                                message={message}
                                userAvatar={user.avatar_url || "/default-avatar.svg"}
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
            </main>
        </div>
    );
}
