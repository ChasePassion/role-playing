const API_BASE_URL = "http://localhost:8000";

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

// --- Auth Interfaces ---

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

// --- API Functions ---

/**
 * Send verification code to email
 */
export async function sendVerificationCode(email: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/v1/auth/send_code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to send code: ${response.status}`);
  }
}

/**
 * Login with email and verification code
 */
export async function loginWithCode(email: string, code: string): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Login failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get current user details
 */
export async function getCurrentUser(token: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get user: ${response.status}`);
  }

  return response.json();
}


/**
 * Send a chat message and receive streaming response via SSE
 */
export async function sendChatMessage(
  request: ChatRequest,
  onChunk: (content: string) => void,
  onDone: (fullContent: string) => void,
  onError: (error: string) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
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
    onError(error instanceof Error ? error.message : "Unknown error");
  }
}

/**
 * Manage memories after a conversation turn
 */
export async function manageMemories(
  request: MemoryManageRequest
): Promise<{ added_ids: number[]; success: boolean }> {
  const response = await fetch(`${API_BASE_URL}/v1/memories/manage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

/**
 * Search memories for context
 */
export async function searchMemories(
  request: MemorySearchRequest
): Promise<{ episodic: unknown[]; semantic: unknown[] }> {
  const response = await fetch(`${API_BASE_URL}/v1/memories/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// --- User Profile Functions ---

export interface UpdateProfileRequest {
  username?: string;
  avatar_url?: string;
}

/**
 * Upload a file (e.g., avatar image)
 */
export async function uploadFile(file: File, token: string): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/v1/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Upload failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Update current user's profile (username, avatar)
 */
export async function updateUserProfile(
  data: UpdateProfileRequest,
  token: string
): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/v1/users/me`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Update failed: ${response.status}`);
  }

  return response.json();
}

// --- Character Interfaces ---

// Visibility enum for character access control
export type CharacterVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED";

export interface CreateCharacterRequest {
  name: string;
  description: string;
  system_prompt: string;
  greeting_message?: string;
  avatar_file_name?: string;
  tags?: string[];
  visibility?: CharacterVisibility; // Default: PRIVATE
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

// --- Character API Functions ---

/**
 * Create a new character
 */
export async function createCharacter(
  data: CreateCharacterRequest,
  token: string
): Promise<CharacterResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/characters`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Create character failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get public market characters
 */
export async function getMarketCharacters(
  skip: number = 0,
  limit: number = 20
): Promise<CharacterResponse[]> {
  const response = await fetch(
    `${API_BASE_URL}/v1/characters/market?skip=${skip}&limit=${limit}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Get characters failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get characters created by a specific user
 */
export async function getUserCharacters(
  creatorId: string,
  token?: string,
  skip: number = 0,
  limit: number = 20
): Promise<CharacterResponse[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(
    `${API_BASE_URL}/v1/users/${creatorId}/characters?skip=${skip}&limit=${limit}`,
    {
      method: "GET",
      headers,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Get user characters failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Get a single character by ID
 */
export async function getCharacterById(
  id: string,
  token?: string
): Promise<CharacterResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/v1/characters/${id}`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Get character failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Update a character
 */
export async function updateCharacter(
  id: string,
  data: UpdateCharacterRequest,
  token: string
): Promise<CharacterResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/characters/${id}`, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Update character failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Delete a character
 */
export async function deleteCharacter(
  id: string,
  token: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/v1/characters/${id}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Delete character failed: ${response.status}`);
  }
}
