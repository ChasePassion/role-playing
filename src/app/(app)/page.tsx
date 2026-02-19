"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import CharacterCard from "@/components/CharacterCard";
import CreateCharacterModal from "@/components/CreateCharacterModal";
import { useAuth } from "@/lib/auth-context";
import WorkspaceFrame from "@/components/layout/WorkspaceFrame";
import { useSidebar } from "./layout";
import { Character } from "@/components/Sidebar";
import { getOrCreateChatId } from "@/lib/chat-helpers";

export default function DiscoverPage() {
    const { user } = useAuth();
    const router = useRouter();
    const {
        setSelectedCharacterId,
        refreshSidebarCharacters,
        sidebarCharacters,
    } = useSidebar();
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Clear selected character when on discover page
    useEffect(() => {
        setSelectedCharacterId(null);
    }, [setSelectedCharacterId]);

    const characters = useMemo(
        () =>
            sidebarCharacters.map((character) => ({
                ...character,
                creator_username:
                    character.creator_id === user?.id ? user?.username : "Creator",
            })),
        [sidebarCharacters, user?.id, user?.username]
    );

    useEffect(() => {
        if (user && sidebarCharacters.length === 0) {
            refreshSidebarCharacters();
        }
    }, [user, sidebarCharacters.length, refreshSidebarCharacters]);

    const handleSelectCharacter = async (character: Character) => {
        try {
            const chatId = await getOrCreateChatId(character.id);
            router.push(`/chat/${chatId}`);
        } catch (err) {
            console.error("Failed to open chat:", err);
        }
    };

    return (
        <WorkspaceFrame>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <div className="max-w-7xl mx-auto pl-8">
                    <div className="mt-8 flex flex-wrap gap-6">
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

            <button
                onClick={() => setIsCreateModalOpen(true)}
                className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#3964FE] text-white shadow-lg transition-all duration-200 hover:scale-105 hover:bg-[#2a4fd6] hover:shadow-xl"
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
                    refreshSidebarCharacters();
                    setIsCreateModalOpen(false);
                }}
            />
        </WorkspaceFrame>
    );
}
