import { ApiError, tokenStore, UnauthorizedError } from "./token-store";

interface SuccessEnvelope<T> {
    code: string;
    message: string;
    status: number;
    data: T;
}

interface ErrorEnvelope {
    code?: string;
    message?: string;
    detail?: string;
    status?: number;
}

class HttpClient {
    private baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
    }

    private async parseJson(response: Response): Promise<unknown> {
        return response.json().catch(() => undefined);
    }

    private unwrapEnvelope<T>(payload: unknown): T {
        if (
            payload &&
            typeof payload === "object" &&
            "code" in payload &&
            "status" in payload &&
            "data" in payload
        ) {
            return (payload as SuccessEnvelope<T>).data;
        }

        return payload as T;
    }

    private async handleError(response: Response): Promise<never> {
        const payload = (await this.parseJson(response)) as ErrorEnvelope | undefined;
        const code = payload?.code;
        const message =
            payload?.message ||
            payload?.detail ||
            `API Error: ${response.status}`;

        if (response.status === 401) {
            tokenStore.clearToken();
            throw new UnauthorizedError(message);
        }

        throw new ApiError(response.status, code, message);
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(options.headers as Record<string, string>),
        };

        const token = tokenStore.getToken();
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            return this.handleError(response);
        }

        if (response.status === 204) {
            return undefined as T;
        }

        const payload = await this.parseJson(response);
        return this.unwrapEnvelope<T>(payload);
    }

    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "GET" });
    }

    async post<T, B = unknown>(endpoint: string, data?: B): Promise<T> {
        return this.request<T>(endpoint, {
            method: "POST",
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    async put<T, B = unknown>(endpoint: string, data?: B): Promise<T> {
        return this.request<T>(endpoint, {
            method: "PUT",
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "DELETE" });
    }

    async upload<T = unknown>(endpoint: string, file: File): Promise<T> {
        const token = tokenStore.getToken();
        const headers: Record<string, string> = {};

        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`${this.baseURL}${endpoint}`, {
            method: "POST",
            headers,
            body: formData,
        });

        if (!response.ok) {
            return this.handleError(response);
        }

        if (response.status === 204) {
            return undefined as T;
        }

        const payload = await this.parseJson(response);
        return this.unwrapEnvelope<T>(payload);
    }
}

export const httpClient = new HttpClient("");
