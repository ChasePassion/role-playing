"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import CharacterCard from "@/components/CharacterCard";
import CreateCharacterModal from "@/components/CreateCharacterModal";
import { getMarketCharacters, CharacterResponse, getRecentChat, createChatInstance } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "./layout";
import { Character } from "@/components/Sidebar";

export default function DiscoverPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { setSelectedCharacterId, refreshSidebarCharacters } = useSidebar();

    const [characters, setCharacters] = useState<Character[]>([]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Clear selected character when on discover page
    useEffect(() => {
        setSelectedCharacterId(null);
    }, [setSelectedCharacterId]);

    // Load characters from API
    const loadCharacters = useCallback(async () => {
        try {
            const apiCharacters = await getMarketCharacters();
            // Map API response to Character interface
            const mapped: Character[] = apiCharacters.map((c: CharacterResponse) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                avatar: c.avatar_file_name ? `${c.avatar_file_name}` : "/default-avatar.svg",
                system_prompt: c.system_prompt,
                tags: c.tags,
                visibility: c.visibility,
                creator_id: c.creator_id,
                creator_username: c.creator_id === user?.id ? user?.username : "Creator",
            }));
            setCharacters(mapped);
        } catch (err) {
            console.error("Failed to load characters from API:", err);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            loadCharacters();
        }
    }, [user, loadCharacters]);

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

    return (
        <>
            {/* Content Area - Completely Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="max-w-7xl mx-auto pl-8">
                    {/* Header removed as requested */}
                    <div className="flex flex-wrap gap-6 mt-8">
                        {characters.map((character) => (
                            <CharacterCard
                                key={character.id}
                                character={character}
                                onClick={handleSelectCharacter}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Create Character FAB Button */}
            <button
                onClick={() => setIsCreateModalOpen(true)}
                className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#3964FE] text-white shadow-lg hover:bg-[#2a4fd6] hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center z-40"
                aria-label="创建角色"
            >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
            </button>

            <CreateCharacterModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    loadCharacters(); // Refresh list
                    refreshSidebarCharacters(); // Refresh sidebar
                    setIsCreateModalOpen(false);
                }}
            />
        </>
    );
}
