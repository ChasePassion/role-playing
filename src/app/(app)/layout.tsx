"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, isProfileComplete } from "@/lib/auth-context";
import Sidebar, { Character } from "@/components/Sidebar";
import AppFrame from "@/components/layout/AppFrame";
import { useSidebarShell } from "@/hooks/useSidebarShell";
import { mapCharacterToSidebar } from "@/lib/character-adapter";
import { isSetupBypassPath } from "@/lib/billing-plans";
import { UserSettingsProvider } from "@/lib/user-settings-context";
import { GrowthProvider } from "@/lib/growth-context";
import CheckInCalendarDialog from "@/components/growth/CheckInCalendarDialog";
import {
    useGetOrCreateChatMutation,
    useSidebarCharactersQuery,
} from "@/lib/query";

// Context for sidebar state
interface SidebarContextType {
    isSidebarOpen: boolean;
    isOverlay: boolean;
    toggleSidebar: () => void;
    closeSidebar: () => void;
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
    const pathname = usePathname();

    const { isSidebarOpen, isOverlay, toggle: toggleSidebar, close: closeSidebar } = useSidebarShell();
    const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
    const {
        data: sidebarApiCharacters,
        refetch: refetchSidebarCharacters,
    } = useSidebarCharactersQuery(user?.id);
    const openChatMutation = useGetOrCreateChatMutation(user?.id);
    const sidebarCharacters = useMemo<Character[]>(
        () =>
            (sidebarApiCharacters ?? []).map((character) =>
                mapCharacterToSidebar(character),
            ),
        [sidebarApiCharacters],
    );

    // Redirect if not authenticated or profile incomplete
    useEffect(() => {
        if (!isAuthLoading) {
            if (!user) {
                router.push("/login");
            } else if (!isProfileComplete(user) && !isSetupBypassPath(pathname)) {
                router.push("/setup");
            }
        }
    }, [user, isAuthLoading, pathname, router]);

    const refreshSidebarCharacters = useCallback(async () => {
        if (!user) return;
        await refetchSidebarCharacters();
    }, [refetchSidebarCharacters, user]);

    const handleSelectCharacter = async (character: Character) => {
        try {
            const chatId = await openChatMutation.mutateAsync(character.id);
            router.push(`/chat/${chatId}`);
        } catch (err) {
            console.error("Failed to open chat:", err);
        }
    };

    const sidebarContextValue = useMemo(
        () => ({
            isSidebarOpen,
            isOverlay,
            toggleSidebar,
            closeSidebar,
            sidebarCharacters,
            selectedCharacterId,
            setSelectedCharacterId,
            refreshSidebarCharacters,
        }),
        [
            isSidebarOpen,
            isOverlay,
            toggleSidebar,
            closeSidebar,
            sidebarCharacters,
            selectedCharacterId,
            refreshSidebarCharacters,
        ],
    );

    // Show loading state while checking auth
    if (isAuthLoading || !user) {
        return (
            <div className="flex h-screen items-center justify-center bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <UserSettingsProvider>
            <GrowthProvider>
                <SidebarContext.Provider value={sidebarContextValue}>
                    <AppFrame
                        sidebar={
                            <Sidebar
                                characters={sidebarCharacters}
                                selectedCharacterId={selectedCharacterId}
                                onSelectCharacter={handleSelectCharacter}
                                onToggle={toggleSidebar}
                                isCollapsed={!isSidebarOpen}
                            />
                        }
                        isSidebarOpen={isSidebarOpen}
                        isOverlay={isOverlay}
                        onCloseSidebar={closeSidebar}
                    >
                        {children}
                    </AppFrame>
                </SidebarContext.Provider>
                <CheckInCalendarDialog />
            </GrowthProvider>
        </UserSettingsProvider>
    );
}
