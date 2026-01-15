import { tokenStore, UnauthorizedError, ApiError } from "./token-store";

class HttpClient {
    private baseURL: string;

    constructor(baseURL: string) {
        this.baseURL = baseURL;
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
            if (response.status === 401) {
                // 统一处理 401：先清 token，再抛错误
                tokenStore.clearToken();
                throw new UnauthorizedError();
            }

            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(response.status, errorData.detail);
        }

        return response.json();
    }

    async get<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "GET" });
    }

    async post<T>(endpoint: string, data?: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: "POST",
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    async put<T>(endpoint: string, data?: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: "PUT",
            body: data ? JSON.stringify(data) : undefined,
        });
    }

    async delete<T>(endpoint: string): Promise<T> {
        return this.request<T>(endpoint, { method: "DELETE" });
    }

    async upload(endpoint: string, file: File): Promise<any> {
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
            if (response.status === 401) {
                tokenStore.clearToken();
                throw new UnauthorizedError();
            }

            const errorData = await response.json().catch(() => ({}));
            throw new ApiError(response.status, errorData.detail);
        }

        return response.json();
    }
}

export const httpClient = new HttpClient("");