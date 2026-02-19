"use client";

import Image from "next/image";
import type { Character } from "./Sidebar";

interface ChatHeaderProps {
    character?: Character | null;
}

export default function ChatHeader({ character }: ChatHeaderProps) {
    if (!character) {
        return <div className="w-full h-[64px] border-b border-divider bg-white" />;
    }

    return (
        <div className="w-full h-[64px] flex items-center gap-3 px-[14px] py-[14px] border-b border-divider bg-white">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                <Image
                    src={character.avatar}
                    alt={character.name}
                    fill
                    className="object-cover"
                />
            </div>
            <h2 className="text-base font-semibold text-text-primary">
                {character.name}
            </h2>
        </div>
    );
}
