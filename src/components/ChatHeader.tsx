"use client";

import Image from "next/image";
import type { Character } from "./Sidebar";

interface ChatHeaderProps {
    character: Character;
}

export default function ChatHeader({ character }: ChatHeaderProps) {
    return (
        <div className="flex items-center gap-3 p-4 border-b border-divider bg-white">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
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
