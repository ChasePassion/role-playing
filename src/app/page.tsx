"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { Character, SidebarToggleIcon } from "@/components/Sidebar";
import CharacterCard from "@/components/CharacterCard";
import ChatHeader from "@/components/ChatHeader";
import ChatMessage, { Message } from "@/components/ChatMessage";
import ChatInput from "@/components/ChatInput";
import { sendChatMessage, manageMemories } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

// Generate unique IDs for messages
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Generate chat ID for a conversation session
function generateChatId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export default function Home() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatId, setChatId] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // isOverlay determines if sidebar overlays (true) or pushes (false) content
  const [isOverlay, setIsOverlay] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !user) {
      router.push("/login");
    }
  }, [user, isAuthLoading, router]);

  // Load characters on mount
  useEffect(() => {
    if (!user) return; // Don't load if not logged in

    fetch("/characters.json")
      .then((res) => res.json())
      .then((data) => setCharacters(data.characters))
      .catch((err) => console.error("Failed to load characters:", err));
  }, [user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Only close sidebar when it's OPEN and window becomes < 800px
  useEffect(() => {
    const handleResize = () => {
      if (isSidebarOpen && window.innerWidth < 800) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isSidebarOpen]);

  // Toggle sidebar with mode detection
  const handleToggleSidebar = () => {
    if (isSidebarOpen) {
      // Closing sidebar
      setIsSidebarOpen(false);
    } else {
      // Opening sidebar - check window size to determine mode
      const shouldOverlay = window.innerWidth < 800;
      setIsOverlay(shouldOverlay);
      setIsSidebarOpen(true);
    }
  };

  const handleSelectCharacter = (character: Character) => {
    setSelectedCharacter(character);
    setMessages([]);
    setChatId(generateChatId());
    // Auto close on overlay mode
    if (isOverlay) {
      setIsSidebarOpen(false);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedCharacter || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // Create assistant message placeholder
    const assistantMessageId = generateId();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
    };
    setMessages((prev) => [...prev, assistantMessage]);

    // Build history for API
    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    let fullResponse = "";

    // Send to API with streaming
    await sendChatMessage(
      {
        user_id: user?.id || "unknown",
        chat_id: chatId,
        message: content,
        history,
      },
      // On chunk
      (chunk) => {
        fullResponse += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, content: fullResponse } : m
          )
        );
      },
      // On done
      async (finalContent) => {
        // Update with final content
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId ? { ...m, content: finalContent } : m
          )
        );
        setIsLoading(false);

        // Manage memories in background
        try {
          await manageMemories({
            user_id: user?.id || "unknown",
            chat_id: chatId,
            user_text: content,
            assistant_text: finalContent,
          });
        } catch (err) {
          console.error("Failed to manage memories:", err);
        }
      },
      // On error
      (error) => {
        console.error("Chat error:", error);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: "抱歉，发生了错误，请稍后重试。" }
              : m
          )
        );
        setIsLoading(false);
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

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Overlay background - only show when sidebar is open in overlay mode */}
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
          characters={characters}
          selectedCharacterId={selectedCharacter?.id || null}
          onSelectCharacter={handleSelectCharacter}
          onToggle={handleToggleSidebar}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
        {/* Toggle Button - Show when sidebar is closed */}
        {!isSidebarOpen && (
          <button
            onClick={handleToggleSidebar}
            className="absolute top-4 left-4 z-30 p-2 rounded-lg hover:bg-gray-100 text-gray-500"
            aria-label="Open Sidebar"
          >
            <SidebarToggleIcon className="w-5 h-5" />
          </button>
        )}

        {selectedCharacter ? (
          <>
            {/* Chat header */}
            <div className={`${!isSidebarOpen ? "pl-14" : ""}`}>
              <ChatHeader character={selectedCharacter} />
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  userAvatar="/openai.svg"
                  assistantAvatar={selectedCharacter.avatar}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 bg-white">
              <ChatInput onSend={handleSendMessage} disabled={isLoading} />
            </div>
          </>
        ) : (
          /* Character grid when no character selected */
          <div className={`flex-1 p-5 overflow-y-auto custom-scrollbar`}>
            <h2 className={`text-xl ml-10 font-semibold text-text-primary mb-6`}>
              选择一个角色开始对话
            </h2>
            <div className={`flex flex-wrap gap-6 max-w-6xl ml-10`}>
              {characters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  onClick={handleSelectCharacter}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
