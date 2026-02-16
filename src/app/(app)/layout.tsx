"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, isProfileComplete } from "@/lib/auth-context";
import { getMarketCharacters, CharacterResponse, getRecentChat, createChatInstance } from "@/lib/api";
import Sidebar, { Character, SidebarToggleIcon } from "@/components/Sidebar";

// Context for sidebar state
interface SidebarContextType {
    isSidebarOpen: boolean;
    isOverlay: boolean;
    toggleSidebar: () => void;
    sidebarCharacters: Character[];
    selectedCharacterId: string | null;
    setSelectedCharacterId: (id: string | null) => void;
    refreshSidebarCharacters: () => Promise<void>;
}

const SidebarContext = createContext<SidebarContextType | null>(null);

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within AppLayout");
    }
    return context;
}

export default function AppLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isOverlay, setIsOverlay] = useState(false);
    const [sidebarCharacters, setSidebarCharacters] = useState<Character[]>([]);
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

    // Redirect if not authenticated or profile incomplete
    useEffect(() => {
        if (!isAuthLoading) {
            if (!user) {
                router.push("/login");
            } else if (!isProfileComplete(user)) {
                router.push("/setup");
            }
        }
    }, [user, isAuthLoading, router]);

    // Load sidebar characters
    const refreshSidebarCharacters = useCallback(async () => {
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
    }, [user]);

    useEffect(() => {
        refreshSidebarCharacters();
    }, [refreshSidebarCharacters]);

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

    const toggleSidebar = () => {
        if (isSidebarOpen) {
            setIsSidebarOpen(false);
        } else {
            const shouldOverlay = window.innerWidth < 800;
            setIsOverlay(shouldOverlay);
            setIsSidebarOpen(true);
        }
    };

    const handleSelectCharacter = async (character: Character) => {
        try {
            const recent = await getRecentChat(character.id);
            const chatId =
                recent?.chat?.id ||
                (await createChatInstance({ character_id: character.id })).chat.id;
            router.push(`/chat/${chatId}`);
        } catch (err) {
            console.error("Failed to open chat:", err);
        }
    };

    // Show loading state while checking auth
    if (isAuthLoading || !user) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <SidebarContext.Provider
            value={{
                isSidebarOpen,
                isOverlay,
                toggleSidebar,
                sidebarCharacters,
                selectedCharacterId,
                setSelectedCharacterId,
                refreshSidebarCharacters,
            }}
        >
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
                        selectedCharacterId={selectedCharacterId}
                        onSelectCharacter={handleSelectCharacter}
                        onToggle={toggleSidebar}
                    />
                </div>

                {/* Main content */}
                <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
                    {/* Toggle Button */}
                    {!isSidebarOpen && (
                        <button
                            onClick={toggleSidebar}
                            className="absolute top-4 left-4 z-30 p-2 rounded-lg hover:bg-gray-100 text-gray-500"
                            aria-label="Open Sidebar"
                        >
                            <SidebarToggleIcon className="w-5 h-5" />
                        </button>
                    )}

                    {children}
                </main>
            </div>
        </SidebarContext.Provider>
    );
}
