export class UnauthorizedError extends Error {
    constructor(message = "authorization failed") {
        super(message);
        this.name = "UnauthorizedError";
    }
}

export class ApiError extends Error {
    constructor(
        public status: number,
        public code?: string,
        public detail?: string
    ) {
        super(detail || `API Error: ${status}`);
        this.name = "ApiError";
    }
}

class TokenStore {
    private token: string | null = null;
    private listeners: ((token: string | null) => void)[] = [];
    private isBrowser: boolean;

    constructor() {
        this.isBrowser = typeof window !== "undefined";
    }

    initFromStorage(): void {
        if (!this.isBrowser) return;
        this.token = localStorage.getItem("access_token");
    }

    private saveToStorage(token: string | null): void {
        if (!this.isBrowser) return;

        if (token) {
            localStorage.setItem("access_token", token);
        } else {
            localStorage.removeItem("access_token");
        }
    }

    getToken(): string | null {
        return this.token;
    }

    setToken(token: string | null): void {
        this.token = token;
        this.saveToStorage(token);
        this.notifyListeners(token);
    }

    clearToken(): void {
        this.setToken(null);
    }

    hasToken(): boolean {
        return !!this.token;
    }

    subscribe(listener: (token: string | null) => void): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter((l) => l !== listener);
        };
    }

    private notifyListeners(token: string | null): void {
        this.listeners.forEach((listener) => listener(token));
    }
}

export const tokenStore = new TokenStore();
