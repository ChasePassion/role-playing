"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { Character } from "./Sidebar";
import { MoreHorizontal } from "lucide-react";
import { CHARACTER_CARD_VISIBLE_TAGS, normalizeCharacterTag } from "@/lib/character-tags";
import { cn } from "@/lib/utils";

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
  onDelete,
}: CharacterCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTagOverflowOpen, setIsTagOverflowOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const tagOverflowRef = useRef<HTMLDivElement>(null);

  const tags = (character.tags ?? [])
    .map((tag) => normalizeCharacterTag(tag))
    .filter((tag) => tag.length > 0);
  const visibleTags = tags.slice(0, CHARACTER_CARD_VISIBLE_TAGS);
  const hiddenTags = tags.slice(CHARACTER_CARD_VISIBLE_TAGS);

  useEffect(() => {
    if (!isMenuOpen && !isTagOverflowOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsMenuOpen(false);
      }
      if (tagOverflowRef.current && !tagOverflowRef.current.contains(target)) {
        setIsTagOverflowOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen, isTagOverflowOpen]);

  return (
    <div
      onClick={() => onClick(character)}
      className="relative block h-[150px] rounded-[20px] overflow-hidden no-underline shadow-[var(--cc-card-shadow)] border border-white/10 transition-all duration-300 cursor-pointer hover:shadow-[var(--cc-card-shadow-hover)] hover:-translate-y-1.5"
    >
      <div
        className="absolute inset-[-30px] bg-cover bg-center blur-[24px] scale-110 z-10"
        style={{ backgroundImage: `url(${character.avatar})` }}
      />

      <div
        className="absolute inset-0 z-20 rounded-[20px] transition-colors duration-300"
        style={{
          backgroundColor: 'var(--cc-card-bg-blur)',
          backgroundImage: 'var(--cc-card-bg-gradient)',
          border: '1px solid var(--cc-card-border)',
        }}
      />

      <div className="relative z-30 flex h-full p-4 gap-[18px] box-border">
        <div className="w-[88px] h-[118px] rounded-[14px] overflow-hidden shadow-[var(--cc-avatar-shadow)] border border-white/10 relative shrink-0">
          <Image src={character.avatar} alt={character.name} fill className="object-cover" />
        </div>

        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div className="flex justify-between items-center mb-1.5 gap-3">
            <h3 className="text-[18px] font-bold text-white m-0 whitespace-nowrap overflow-hidden text-ellipsis drop-shadow-[var(--cc-text-shadow)] tracking-wide">
              {character.name}
            </h3>
            <span className="text-[13px] font-medium shrink-0 inline-flex items-center gap-1 leading-none text-[var(--cc-text-secondary)]">
              <Image src="/message-fill.svg" alt="" width={14} height={14} style={{ filter: 'invert(1)' }} />
              5.6k
            </span>
          </div>

          <p className="text-[13px] text-[var(--cc-text-muted)] leading-6 m-0 mb-3 line-clamp-2 drop-shadow-[var(--cc-text-shadow-light)]">
            {character.description}
          </p>

          {tags.length > 0 && (
            <div className={cn("flex gap-2 mt-auto min-w-0 items-center flex-nowrap", showMenu && "pr-[44px]")}>
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="bg-[var(--cc-tag-bg)] text-[var(--cc-tag-text)] text-[11px] font-semibold py-1 px-[10px] rounded-md tracking-wide shadow-[inset_0_1px_0_var(--cc-tag-border)] inline-flex items-center min-w-0 max-w-[112px] shrink"
                  title={tag}
                >
                  <span className="block overflow-hidden whitespace-nowrap text-ellipsis">{tag}</span>
                </span>
              ))}

              {hiddenTags.length > 0 && (
                <div ref={tagOverflowRef} className="relative shrink-0">
                  <button
                    type="button"
                    className="border border-[var(--cc-tag-overflow-border)] cursor-pointer shrink-0 bg-[var(--cc-tag-bg)] text-[var(--cc-tag-text)] text-[11px] font-semibold py-1 px-[10px] rounded-md tracking-wide hover:bg-[var(--cc-tag-overflow-hover)] transition-colors"
                    aria-expanded={isTagOverflowOpen}
                    aria-label={`查看全部标签，共 ${tags.length} 个`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsTagOverflowOpen((prev) => !prev);
                    }}
                  >
                    +{hiddenTags.length}
                  </button>

                  {isTagOverflowOpen && (
                    <div
                      className="absolute left-0 bottom-[calc(100%+10px)] min-w-[180px] max-w-[220px] p-[10px] rounded-[14px] bg-[var(--cc-tag-overflow-bg)] border border-[var(--cc-tag-overflow-border)] shadow-[0_14px_36px_rgba(0,0,0,0.28)] backdrop-blur-[12px] z-[12]"
                      role="dialog"
                      aria-label="全部标签"
                    >
                      <p className="m-0 mb-2 text-[11px] font-bold text-[var(--cc-text-secondary)] tracking-wider">
                        全部标签
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={`overflow-${tag}`}
                            className="bg-[var(--cc-tag-bg)] text-[var(--cc-tag-text)] text-[11px] font-semibold py-1 px-[10px] rounded-md tracking-wide shadow-[inset_0_1px_0_var(--cc-tag-border)] inline-flex items-center min-w-0 max-w-full shrink"
                            title={tag}
                          >
                            <span className="block overflow-hidden whitespace-nowrap text-ellipsis">{tag}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showMenu && (
        <div ref={menuRef} className="absolute bottom-3 right-3 z-10" onClick={(e) => e.stopPropagation()}>
          <button
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--cc-menu-btn-bg)] backdrop-blur-[4px] border border-[var(--cc-menu-btn-border)] text-[var(--cc-menu-btn-text)] cursor-pointer transition-colors duration-200 hover:bg-[var(--cc-menu-btn-bg-hover)]"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMenuOpen((prev) => !prev);
            }}
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          <div className={cn(
            "absolute right-0 bottom-full mb-2 w-[128px] bg-[var(--cc-dropdown-bg)] rounded-xl shadow-[var(--cc-dropdown-shadow)] border border-[var(--cc-dropdown-border)] p-1.5 flex-col gap-0.5",
            isMenuOpen ? "flex" : "hidden"
          )}>
            <button
              onClick={() => { setIsMenuOpen(false); onEdit?.(character); }}
              className="w-full py-2 px-[10px] flex items-center gap-2 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-[var(--cc-dropdown-item-hover)]"
            >
              <Image src="/edit.svg" alt="Edit" width={16} height={16} />
              <span className="text-sm text-gray-700">编辑</span>
            </button>
            <button
              onClick={() => { setIsMenuOpen(false); onDelete?.(character); }}
              className="w-full py-2 px-[10px] flex items-center gap-2 rounded-lg bg-transparent border-none cursor-pointer transition-colors duration-150 hover:bg-[var(--cc-dropdown-item-danger-hover)]"
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
