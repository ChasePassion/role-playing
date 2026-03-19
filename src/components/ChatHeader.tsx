"use client";

import type { Character } from "./Sidebar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ChatHeaderProps {
    character?: Character | null;
}

export default function ChatHeader({ character }: ChatHeaderProps) {
    if (!character) {
        return (
            <div
                className="w-full h-[64px] border-b border-divider flex items-center"
                style={{ backgroundColor: "var(--workspace-bg)" }}
            />
        );
    }

    return (
        <div
            className="w-full h-[64px] flex items-center gap-3 px-[14px] py-[14px] border-b border-divider"
            style={{ backgroundColor: "var(--workspace-bg)" }}
        >
            <Avatar className="h-10 w-10 rounded-lg overflow-hidden shrink-0">
                <AvatarImage src={character.avatar} alt={character.name} />
                <AvatarFallback className="bg-gray-100 text-gray-600">
                    {character.name.slice(0, 2)}
                </AvatarFallback>
            </Avatar>
            <h2 className="text-base font-semibold text-text-primary">
                {character.name}
            </h2>
        </div>
    );
}
