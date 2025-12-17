"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
    useRef,
} from "react";
import { User } from "./api-service";
import { tokenStore } from "./token-store";
import { apiService } from "./api-service";

interface AuthContextType {
    user: User | null;
    isAuthed: boolean;
    isLoading: boolean;
    login: (email: string, code: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 竞态保护：递增版本号
    const refreshVersionRef = useRef(0);

    const isAuthed = !!user && tokenStore.hasToken();

    // 初始化：只在客户端环境加载用户信息
    useEffect(() => {
        // 显式初始化 TokenStore
        tokenStore.initFromStorage();

        async function loadUser() {
            if (!tokenStore.hasToken()) {
                setIsLoading(false);
                return;
            }

            try {
                const userData = await apiService.getCurrentUser();
                setUser(userData);
            } catch (error) {
                console.log("User not authenticated:", error);
            } finally {
                setIsLoading(false);
            }
        }

        loadUser();
    }, []);

    // 订阅 token 变化：只订阅一次，无依赖
    useEffect(() => {
        const unsubscribe = tokenStore.subscribe(async (token) => {
            if (!token) {
                // token 被清除，立即清除用户状态
                setUser(null);
                return;
            }

            // token 变为非空，刷新用户信息（带竞态保护）
            const currentVersion = ++refreshVersionRef.current;

            try {
                const userData = await apiService.getCurrentUser();

                // 只保留最后一次请求的结果
                if (currentVersion === refreshVersionRef.current) {
                    setUser(userData);
                }
            } catch (error) {
                if (currentVersion === refreshVersionRef.current) {
                    console.log("Failed to refresh user:", error);
                    setUser(null);
                }
            }
        });

        return unsubscribe;
    }, []); // 空依赖数组，只订阅一次

    const login = async (email: string, code: string) => {
        setIsLoading(true);
        try {
            await apiService.login(email, code);
            const userData = await apiService.getCurrentUser();
            setUser(userData);
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        tokenStore.clearToken();
    };

    const refreshUser = async () => {
        if (!tokenStore.hasToken()) {
            setUser(null);
            return;
        }

        const currentVersion = ++refreshVersionRef.current;

        try {
            const userData = await apiService.getCurrentUser();

            if (currentVersion === refreshVersionRef.current) {
                setUser(userData);
            }
        } catch (error) {
            if (currentVersion === refreshVersionRef.current) {
                console.error("Failed to refresh user:", error);
                setUser(null);
            }
        }
    };

    return (
        <AuthContext.Provider
            value={{ user, isAuthed, isLoading, login, logout, refreshUser }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}

export function isProfileComplete(user: User | null): boolean {
    return !!(user?.username && user?.avatar_url);
}
