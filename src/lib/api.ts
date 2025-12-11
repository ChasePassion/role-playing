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
