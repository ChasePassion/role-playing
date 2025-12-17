// 自定义错误类
export class UnauthorizedError extends Error {
    name = "UnauthorizedError";
}

export class ApiError extends Error {
    constructor(
        public status: number,
        public detail?: string,
        message?: string
    ) {
        super(message || detail || `API Error: ${status}`);
        this.name = "ApiError";
    }
}

// TokenStore：SSR 安全的 token 状态管理
class TokenStore {
    private token: string | null = null;
    private listeners: ((token: string | null) => void)[] = [];
    private isBrowser: boolean;

    constructor() {
        // 构造函数不碰 localStorage，确保 SSR 安全
        this.isBrowser = typeof window !== "undefined";
    }

    // 显式初始化，只在客户端环境调用
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
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(token: string | null): void {
        this.listeners.forEach(listener => listener(token));
    }
}

export const tokenStore = new TokenStore();