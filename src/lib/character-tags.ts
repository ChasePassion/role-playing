export const CHARACTER_TAG_LIMIT = 3;
export const CHARACTER_TAG_MAX_LENGTH = 24;
export const CHARACTER_CARD_VISIBLE_TAGS = 2;

export function normalizeCharacterTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ");
}

export function getCharacterTagKey(tag: string): string {
  return normalizeCharacterTag(tag).toLocaleLowerCase();
}

export function hasCharacterTag(tags: string[], candidate: string): boolean {
  const candidateKey = getCharacterTagKey(candidate);
  return tags.some((tag) => getCharacterTagKey(tag) === candidateKey);
}
