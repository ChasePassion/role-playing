import { httpClient } from "./http-client";
import { ApiError, tokenStore, UnauthorizedError } from "./token-store";

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export interface ChatRequest {
    user_id: string;
    character_id: string;
    chat_id: string;
    message: string;
    history?: ChatMessage[];
}

export interface MemoryManageRequest {
    user_id: string;
    character_id: string;
    chat_id: string;
    user_text: string;
    assistant_text: string;
}

export interface MemorySearchRequest {
    user_id: string;
    character_id: string;
    query: string;
}

export interface User {
    id: string;
    email: string;
    username?: string;
    avatar_url?: string;
    created_at: string;
    last_login_at?: string;
}

export interface AuthResponse {
    access_token: string;
    token_type: string;
}

export interface SendCodeRequest {
    email: string;
}

export interface LoginRequest {
    email: string;
    code: string;
}

export interface UpdateProfileRequest {
    username?: string;
    avatar_url?: string;
}

export type CharacterVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";

export interface CreateCharacterRequest {
    name: string;
    description: string;
    system_prompt: string;
    greeting_message?: string;
    avatar_file_name?: string;
    tags?: string[];
    visibility?: CharacterVisibility;
}

export interface CharacterResponse {
    id: string;
    name: string;
    description: string;
    system_prompt: string;
    greeting_message?: string;
    avatar_file_name?: string;
    tags?: string[];
    creator_id: string;
    visibility: CharacterVisibility;
    identifier?: string;
    interaction_count: number;
}

export interface UpdateCharacterRequest {
    name?: string;
    description?: string;
    system_prompt?: string;
    greeting_message?: string;
    avatar_file_name?: string;
    tags?: string[];
    visibility?: CharacterVisibility;
}

interface StreamChunkEvent {
    type: "chunk";
    content: string;
}

interface StreamDoneEvent {
    type: "done";
    full_content: string;
}

interface StreamErrorEvent {
    type: "error";
    code?: string;
    message?: string;
}

type StreamEvent = StreamChunkEvent | StreamDoneEvent | StreamErrorEvent;

export class ApiService {
    async sendVerificationCode(email: string): Promise<void> {
        await httpClient.post("/v1/auth/send_code", { email });
    }

    async login(email: string, code: string): Promise<AuthResponse> {
        const response = await httpClient.post<AuthResponse>("/v1/auth/login", {
            email,
            code,
        });

        tokenStore.setToken(response.access_token);
        return response;
    }

    async getCurrentUser(): Promise<User> {
        return httpClient.get<User>("/v1/auth/me");
    }

    async uploadFile(file: File): Promise<{ url: string }> {
        return httpClient.upload<{ url: string }>("/v1/upload", file);
    }

    async updateUserProfile(data: UpdateProfileRequest): Promise<User> {
        return httpClient.put<User>("/v1/users/me", data);
    }

    async createCharacter(data: CreateCharacterRequest): Promise<CharacterResponse> {
        return httpClient.post<CharacterResponse>("/v1/characters", data);
    }

    async getMarketCharacters(skip = 0, limit = 20): Promise<CharacterResponse[]> {
        return httpClient.get<CharacterResponse[]>(
            `/v1/characters/market?skip=${skip}&limit=${limit}`
        );
    }

    async getCharacterById(id: string): Promise<CharacterResponse> {
        return httpClient.get<CharacterResponse>(`/v1/characters/${id}`);
    }

    async getUserCharacters(
        creatorId: string,
        skip = 0,
        limit = 20
    ): Promise<CharacterResponse[]> {
        return httpClient.get<CharacterResponse[]>(
            `/v1/users/${creatorId}/characters?skip=${skip}&limit=${limit}`
        );
    }

    async updateCharacter(
        id: string,
        data: UpdateCharacterRequest
    ): Promise<CharacterResponse> {
        return httpClient.put<CharacterResponse>(`/v1/characters/${id}`, data);
    }

    async deleteCharacter(id: string): Promise<void> {
        await httpClient.delete(`/v1/characters/${id}`);
    }

    async sendChatMessage(
        request: ChatRequest,
        onChunk: (content: string) => void,
        onDone: (fullContent: string) => void,
        onError: (error: string) => void
    ): Promise<void> {
        try {
            const token = tokenStore.getToken();
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };

            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }

            const response = await fetch(`/v1/chat`, {
                method: "POST",
                headers,
                body: JSON.stringify(request),
            });

            if (!response.ok) {
                const errorData: { code?: string; message?: string; detail?: string } =
                    await response.json().catch(() => ({}));
                const errorMessage =
                    errorData.message ||
                    errorData.detail ||
                    `HTTP error! status: ${response.status}`;

                if (response.status === 401) {
                    tokenStore.clearToken();
                    throw new UnauthorizedError(errorMessage);
                }

                throw new ApiError(response.status, errorData.code, errorMessage);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("No response body");
            }

            const decoder = new TextDecoder();
            let pending = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                pending += decoder.decode(value, { stream: true });
                const lines = pending.split("\n");
                pending = lines.pop() ?? "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data:")) continue;

                    const payload = trimmed.slice(5).trim();
                    if (!payload) continue;

                    try {
                        const data = JSON.parse(payload) as StreamEvent;
                        if (data.type === "chunk") {
                            onChunk(data.content);
                        } else if (data.type === "done") {
                            onDone(data.full_content);
                        } else if (data.type === "error") {
                            if (data.code && data.message) {
                                onError(`${data.code}: ${data.message}`);
                            } else {
                                onError(data.message || "Unknown error");
                            }
                        }
                    } catch {
                        // Ignore malformed stream rows.
                    }
                }
            }
        } catch (error) {
            if (error instanceof UnauthorizedError) {
                onError("Authentication required");
                return;
            }

            if (error instanceof ApiError) {
                onError(error.detail || `API error: ${error.status}`);
                return;
            }

            onError(error instanceof Error ? error.message : "Unknown error");
        }
    }

    async manageMemories(
        request: MemoryManageRequest
    ): Promise<{ added_ids: number[]; success: boolean }> {
        return httpClient.post("/v1/memories/manage", request);
    }

    async searchMemories(
        request: MemorySearchRequest
    ): Promise<{ episodic: unknown[]; semantic: unknown[] }> {
        return httpClient.post("/v1/memories/search", request);
    }
}

export const apiService = new ApiService();
