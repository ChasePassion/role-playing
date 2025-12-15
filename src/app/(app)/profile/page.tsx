"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import CharacterCard from "@/components/CharacterCard";
import CreateCharacterModal from "@/components/CreateCharacterModal";
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog";
import { getUserCharacters, deleteCharacter, CharacterResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "../layout";
import { Character } from "@/components/Sidebar";

export default function ProfilePage() {
    const { user } = useAuth();
    const { setSelectedCharacterId, refreshSidebarCharacters } = useSidebar();

    const [characters, setCharacters] = useState<Character[]>([]);

    // Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editCharacter, setEditCharacter] = useState<Character | undefined>(undefined);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [characterToDelete, setCharacterToDelete] = useState<Character | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Tab State
    const [activeTab, setActiveTab] = useState<'works' | 'likes' | 'favorites'>('works');

    // Clear selected character when on profile page
    useEffect(() => {
        setSelectedCharacterId(null);
    }, [setSelectedCharacterId]);

    // Load User Characters
    const loadUserCharacters = useCallback(async () => {
        if (!user) return;
        try {
            const token = localStorage.getItem("access_token");
            if (!token) return;

            const apiCharacters = await getUserCharacters(user.id, token);
            const mapped: Character[] = apiCharacters.map((c: CharacterResponse) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                avatar: c.avatar_file_name ? `${c.avatar_file_name}` : "/default-avatar.svg",
                system_prompt: c.system_prompt,
                tags: c.tags,
                visibility: c.visibility,
                creator_id: c.creator_id,
                creator_username: user.username,
            }));
            setCharacters(mapped);
        } catch (err) {
            console.error("Failed to load user characters:", err);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            loadUserCharacters();
        }
    }, [user, loadUserCharacters]);

    // Actions
    const handleEdit = (character: Character) => {
        setEditCharacter(character);
        setIsCreateModalOpen(true);
    };

    const handleDeleteClick = (character: Character) => {
        setCharacterToDelete(character);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!characterToDelete || !user) return;

        setIsDeleting(true);
        try {
            const token = localStorage.getItem("access_token");
            if (!token) throw new Error("No token");

            await deleteCharacter(characterToDelete.id, token);
            await loadUserCharacters(); // Refresh list
            await refreshSidebarCharacters(); // Refresh sidebar
            setIsDeleteDialogOpen(false);
            setCharacterToDelete(null);
        } catch (err) {
            console.error("Delete failed:", err);
            alert("删除失败，请稍后重试");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleModalClose = () => {
        setIsCreateModalOpen(false);
        setEditCharacter(undefined);
    };

    const handleModalSuccess = () => {
        loadUserCharacters();
        refreshSidebarCharacters(); // Refresh sidebar when character created/edited
        // Modal will be closed by handleModalClose which is called by onClose prop wrapper or directly
    };

    return (
        <>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pl-12">
                <div className="max-w-7xl mx-auto">
                    {/* Profile Header */}
                    <div className="flex items-center gap-6 mb-12 mt-4 ml-2">
                        <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0">
                            <Image
                                src={user?.avatar_url || "/default-avatar.svg"}
                                alt={user?.username || "User"}
                                fill
                                className="object-cover"
                            />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-1">{user?.username}</h1>
                            <p className="text-gray-400 text-sm">{user?.email || "user@example.com"}</p>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-8 border-b border-gray-200 mb-8 w-[80%]">
                        <button
                            onClick={() => setActiveTab('works')}
                            className={`pb-3 px-1 text-lg font-medium transition-colors relative ${activeTab === 'works' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            作品
                            {activeTab === 'works' && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('likes')}
                            className={`pb-3 px-1 text-lg font-medium transition-colors relative ${activeTab === 'likes' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            喜欢
                            {activeTab === 'likes' && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('favorites')}
                            className={`pb-3 px-1 text-lg font-medium transition-colors relative ${activeTab === 'favorites' ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            收藏
                            {activeTab === 'favorites' && (
                                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-full" />
                            )}
                        </button>
                    </div>

                    {/* Content Grid */}
                    {activeTab === 'works' && (
                        <div className="flex flex-wrap gap-6 mb-10">
                            {characters.map((character) => (
                                <CharacterCard
                                    key={character.id}
                                    character={character}
                                    onClick={() => handleEdit(character)} // Click to edit ? or maybe just view details
                                    showMenu={true}
                                    onEdit={handleEdit}
                                    onDelete={handleDeleteClick}
                                />
                            ))}
                        </div>
                    )}

                    {activeTab !== 'works' && (
                        <div className="py-20 text-center text-gray-400">
                            暂无内容
                        </div>
                    )}

                </div>
            </div>

            {/* Modals */}
            <CreateCharacterModal
                isOpen={isCreateModalOpen}
                onClose={handleModalClose}
                onSuccess={handleModalSuccess}
                character={editCharacter}
                mode={editCharacter ? 'edit' : 'create'}
            />

            <DeleteConfirmDialog
                isOpen={isDeleteDialogOpen}
                characterName={characterToDelete?.name || ""}
                onConfirm={handleConfirmDelete}
                onCancel={() => {
                    setIsDeleteDialogOpen(false);
                    setCharacterToDelete(null);
                }}
                isDeleting={isDeleting}
            />
        </>
    );
}
