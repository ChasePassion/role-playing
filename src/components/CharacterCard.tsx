"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Character } from "./Sidebar";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, MessageCircle } from "lucide-react";

interface CharacterCardProps {
    character: Character;
    onClick: (character: Character) => void;
    showMenu?: boolean;
    onEdit?: (character: Character) => void;
    onDelete?: (character: Character) => void;
}

const TAG_COLORS = [
    { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
    { bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-200" },
    { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
    { bg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-200" },
    { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
    { bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
];

export default function CharacterCard({
    character,
    onClick,
    showMenu = false,
    onEdit,
    onDelete
}: CharacterCardProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!showMenu || !isMenuOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (menuRef.current && !menuRef.current.contains(target)) {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showMenu, isMenuOpen]);

    return (
        <div
            onClick={() => onClick(character)}
            className="group relative flex w-[404px] h-[200px] bg-white rounded-2xl border border-gray-100 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-pointer overflow-hidden"
        >
            <div className="w-[35%] h-full relative overflow-hidden bg-gray-100">
                <Image
                    src={character.avatar}
                    alt={character.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-black/60 backdrop-blur-md px-2 py-1 rounded-full z-10">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                    <span className="text-[10px] text-white font-medium">Online</span>
                </div>
            </div>

            <div className="flex-1 p-2.5 flex flex-col">
                <div className="flex-1 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                                {character.name}
                            </h3>
                            <p className="text-xs text-gray-400 mt-0.5">
                                @{character.creator_username || "Creator"} • 5.6k 人正在聊
                            </p>
                        </div>
                    </div>

                    {character.tags && character.tags.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                            {character.tags.map((tag, index) => {
                                const color = TAG_COLORS[index % TAG_COLORS.length];
                                return (
                                    <Badge
                                        key={index}
                                        variant="outline"
                                        className={`${color.bg} ${color.text} ${color.border} text-[10px] font-bold rounded border px-2 py-0.5`}
                                    >
                                        #{tag}
                                    </Badge>
                                );
                            })}
                        </div>
                    )}

                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                        {character.description}
                    </p>
                </div>

                <div className="mt-3 flex justify-between items-center relative">
                    <span className="text-xs text-gray-400">上次活跃: 刚刚</span>

                    {showMenu ? (
                        <div
                            ref={menuRef}
                            className="relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setIsMenuOpen((prev) => !prev);
                                }}
                            >
                                <MoreHorizontal className="w-5 h-5" />
                            </button>
                            <div
                                className={`${isMenuOpen ? "flex" : "hidden"} flex-col gap-0.5 absolute right-0 bottom-full mb-2 w-32 bg-white rounded-xl shadow-lg border border-gray-100 z-20 p-1.5`}
                            >
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        onEdit?.(character);
                                    }}
                                    className="w-full px-2.5 py-2 flex items-center gap-2 hover:bg-gray-100 rounded-lg text-left transition-colors"
                                >
                                    <Image src="/edit.svg" alt="Edit" width={16} height={16} />
                                    <span className="text-sm text-gray-700">编辑</span>
                                </button>
                                <button
                                    onClick={() => {
                                        setIsMenuOpen(false);
                                        onDelete?.(character);
                                    }}
                                    className="w-full px-2.5 py-2 flex items-center gap-2 hover:bg-red-100 rounded-lg text-left transition-colors"
                                >
                                    <Image
                                        src="/delete.svg"
                                        alt="Delete"
                                        width={16}
                                        height={16}
                                        style={{ filter: "invert(16%) sepia(96%) saturate(6932%) hue-rotate(357deg) brightness(90%) contrast(125%)" }}
                                    />
                                    <span className="text-sm text-red-600">删除</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 shadow-sm border border-gray-100">
                            <MessageCircle className="w-5 h-5" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
