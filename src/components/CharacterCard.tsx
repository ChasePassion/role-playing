"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Character } from "./Sidebar";
import { MoreHorizontal } from "lucide-react";
import "./CharacterCard.css";

interface CharacterCardProps {
    character: Character;
    onClick: (character: Character) => void;
    showMenu?: boolean;
    onEdit?: (character: Character) => void;
    onDelete?: (character: Character) => void;
}

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
            className="glass-card"
        >
            <div className="glass-bg" style={{ backgroundImage: `url(${character.avatar})` }} />
            <div className="glass-overlay" />

            <div className="glass-content">
                <div className="card-avatar">
                    <Image
                        src={character.avatar}
                        alt={character.name}
                        fill
                        className="object-cover"
                    />
                </div>
                <div className="card-info">
                    <div className="card-header">
                        <h3 className="card-name">{character.name}</h3>
                        <span className="card-stats">
                            <Image
                                src="/message-fill.svg"
                                alt=""
                                width={14}
                                height={14}
                                style={{ filter: 'invert(1)' }}
                            />
                            5.6k
                        </span>
                    </div>
                    <p className="card-desc">{character.description}</p>
                    {character.tags && character.tags.length > 0 && (
                        <div className="card-tags">
                            {character.tags.map((tag, i) => (
                                <span key={i} className="tag">{tag}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showMenu && (
                <div
                    ref={menuRef}
                    className="card-menu-trigger"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="menu-button"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsMenuOpen((prev) => !prev);
                        }}
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                    <div className={`menu-dropdown ${isMenuOpen ? "flex" : "hidden"}`}>
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                onEdit?.(character);
                            }}
                            className="menu-item"
                        >
                            <Image src="/edit.svg" alt="Edit" width={16} height={16} />
                            <span className="text-sm text-gray-700">编辑</span>
                        </button>
                        <button
                            onClick={() => {
                                setIsMenuOpen(false);
                                onDelete?.(character);
                            }}
                            className="menu-item menu-item-danger"
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
            )}
        </div>
    );
}