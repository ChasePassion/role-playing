"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar, { Character, SidebarToggleIcon } from "@/components/Sidebar";
import CharacterCard from "@/components/CharacterCard";
import CreateCharacterModal from "@/components/CreateCharacterModal";
import { getMarketCharacters, CharacterResponse } from "@/lib/api";
import { useAuth, isProfileComplete } from "@/lib/auth-context";

export default function DiscoverPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  // isOverlay determines if sidebar overlays (true) or pushes (false) content
  const [isOverlay, setIsOverlay] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  // Load characters from API
  const loadCharacters = async () => {
    try {
      const apiCharacters = await getMarketCharacters();
      // Map API response to Character interface
      const mapped: Character[] = apiCharacters.map((c: CharacterResponse) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        avatar: c.avatar_url || "/default-avatar.svg",
        system_prompt: c.system_prompt,
        tags: c.tags,
        is_public: c.is_public,
        creator_id: c.creator_id,
        creator_username: c.creator_id === user?.id ? user?.username : "Creator", // Simplified for now
      }));
      setCharacters(mapped);
    } catch (err) {
      console.error("Failed to load characters from API:", err);
    }
  };

  useEffect(() => {
    if (user) {
      loadCharacters();
    }
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

  const handleSelectCharacter = (character: Character) => {
    // Navigate to chat or detail page in future
    // For now just console log
    console.log("Selected character:", character);
    // router.push(`/chat/${character.id}`); 
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
          characters={characters} // In discover page, sidebar history might be different, but using same list for now
          selectedCharacterId={null}
          onSelectCharacter={handleSelectCharacter}
          onToggle={handleToggleSidebar}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden relative">
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
      </main>

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
          setIsCreateModalOpen(false);
        }}
      />
    </div>
  );
}
