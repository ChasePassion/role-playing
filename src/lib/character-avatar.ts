import type { AvatarUrls } from "./api-service";

const DEFAULT_CHARACTER_AVATAR = "/default-avatar.svg";

export type AvatarSize = "sm" | "md" | "lg" | "xl";

export interface AvatarSource {
  avatar_urls?: AvatarUrls | null;
  avatar_image_key?: string | null;
}

const SIZE_TO_FILE: Record<AvatarSize, string> = {
  sm: "96.avif",
  md: "192.avif",
  lg: "512.avif",
  xl: "512.avif",
};

export function isR2AvatarImageKey(value?: string | null): value is string {
  return Boolean(value?.trim().startsWith("images/avatars/"));
}

function mediaBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.trim() || "/media").replace(/\/$/, "");
}

function resolveAvatarUrls(avatarUrls: AvatarUrls | null | undefined, size: AvatarSize): string | undefined {
  if (!avatarUrls) {
    return undefined;
  }
  return avatarUrls[size] || avatarUrls.md || avatarUrls.lg || avatarUrls.sm || avatarUrls.xl;
}

export function resolveAvatarSrc(
  source?: AvatarSource | string | null,
  size: AvatarSize = "md",
): string | undefined {
  if (!source) {
    return undefined;
  }

  if (typeof source === "string") {
    if (isR2AvatarImageKey(source)) {
      return `${mediaBaseUrl()}/${source}/${SIZE_TO_FILE[size]}`;
    }
    return undefined;
  }

  const fromUrls = resolveAvatarUrls(source.avatar_urls, size);
  if (fromUrls) {
    return fromUrls;
  }

  if (source.avatar_image_key) {
    return `${mediaBaseUrl()}/${source.avatar_image_key}/${SIZE_TO_FILE[size]}`;
  }

  return undefined;
}

export function resolveCharacterAvatarSrc(
  source?: AvatarSource | string | null,
  size: AvatarSize = "md",
): string {
  return resolveAvatarSrc(source, size) ?? DEFAULT_CHARACTER_AVATAR;
}

export function resolveVoiceAvatarSrc(
  source?: AvatarSource | string | null,
  size: AvatarSize = "md",
): string | undefined {
  return resolveAvatarSrc(source, size);
}
