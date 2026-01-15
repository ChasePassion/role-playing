import { httpClient } from "./http-client";
import { tokenStore, UnauthorizedError } from "./token-store";

// Type definitions (moved from api.ts)
export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
}

export interface ChatRequest {
    user_id: string;
    chat_id: string;
    message: string;
    history?: ChatMessage[];
}

export interface MemoryManageRequest {
    user_id: string;
    chat_id: string;
    user_text: string;
    assistant_text: string;
}

export interface MemorySearchRequest {
    user_id: string;
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

export class ApiService {
    // 认证相关
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
        return await httpClient.get<User>("/v1/auth/me");
    }

    // 用户相关
    async uploadFile(file: File): Promise<{ url: string }> {
        return await httpClient.upload("/v1/upload", file);
    }

    async updateUserProfile(data: UpdateProfileRequest): Promise<User> {
        return await httpClient.put<User>("/v1/users/me", data);
    }

    // 角色相关
    async createCharacter(data: CreateCharacterRequest): Promise<CharacterResponse> {
        return await httpClient.post<CharacterResponse>("/v1/characters", data);
    }

    async getMarketCharacters(skip = 0, limit = 20): Promise<CharacterResponse[]> {
        return httpClient.get<CharacterResponse[]>(`/v1/characters/market?skip=${skip}&limit=${limit}`);
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
        return await httpClient.put<CharacterResponse>(`/v1/characters/${id}`, data);
    }

    async deleteCharacter(id: string): Promise<void> {
        await httpClient.delete(`/v1/characters/${id}`);
    }

    // 聊天相关
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
                if (response.status === 401) {
                    // 统一处理 401：先清 token，再抛错误
                    tokenStore.clearToken();
                    throw new UnauthorizedError();
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error("No response body");
            }

            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.type === "chunk") {
                                onChunk(data.content);
                            } else if (data.type === "done") {
                                onDone(data.full_content);
                            } else if (data.type === "error") {
                                onError(data.content || "Unknown error");
                            }
                        } catch {
                            // Ignore JSON parse errors for incomplete chunks
                        }
                    }
                }
            }
        } catch (error) {
            if (error instanceof UnauthorizedError) {
                onError("Authentication required");
            } else {
                onError(error instanceof Error ? error.message : "Unknown error");
            }
        }
    }

    // 记忆相关
    async manageMemories(request: MemoryManageRequest): Promise<{ added_ids: number[]; success: boolean }> {
        return httpClient.post("/v1/memories/manage", request);
    }

    async searchMemories(request: MemorySearchRequest): Promise<{ episodic: unknown[]; semantic: unknown[] }> {
        return httpClient.post("/v1/memories/search", request);
    }
}

export const apiService = new ApiService();
