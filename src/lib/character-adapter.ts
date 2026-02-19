import type { Character } from "@/components/Sidebar";
import type {
    CharacterVisibility,
} from "./api-service";

interface CharacterLike {
    id: string;
    name: string;
    description: string;
    system_prompt?: string;
    greeting_message?: string;
    avatar_file_name?: string;
    tags?: string[];
    visibility?: CharacterVisibility;
    creator_id?: string | null;
}

interface MapCharacterOptions {
    creatorUsername?: string;
}

export function mapCharacterToSidebar(
    source: CharacterLike,
    options: MapCharacterOptions = {}
): Character {
    return {
        id: source.id,
        name: source.name,
        description: source.description,
        avatar: source.avatar_file_name || "/default-avatar.svg",
        system_prompt: source.system_prompt,
        greeting_message: source.greeting_message,
        tags: source.tags,
        visibility: source.visibility,
        creator_id: source.creator_id ?? undefined,
        creator_username: options.creatorUsername,
    };
}
