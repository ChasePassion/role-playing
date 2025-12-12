"use client";

import {
    createContext,
    useContext,
    useEffect,
    useState,
    ReactNode,
} from "react";
import { User, AuthResponse, getCurrentUser, loginWithCode } from "./api";

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (email: string, code: string) => Promise<void>;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Load user from token on mount
    useEffect(() => {
        async function loadUser() {
            const token = localStorage.getItem("access_token");
            if (!token) {
                setIsLoading(false);
                return;
            }

            try {
                const userData = await getCurrentUser(token);
                setUser(userData);
            } catch (error) {
                console.error("Failed to load user:", error);
                localStorage.removeItem("access_token");
            } finally {
                setIsLoading(false);
            }
        }

        loadUser();
    }, []);

    const login = async (email: string, code: string) => {
        setIsLoading(true);
        try {
            const response: AuthResponse = await loginWithCode(email, code);
            localStorage.setItem("access_token", response.access_token);
            const userData = await getCurrentUser(response.access_token);
            setUser(userData);
        } catch (error) {
            console.error("Login failed:", error);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem("access_token");
        setUser(null);
    };

    const refreshUser = async () => {
        const token = localStorage.getItem("access_token");
        if (!token) return;

        try {
            const userData = await getCurrentUser(token);
            setUser(userData);
        } catch (error) {
            console.error("Failed to refresh user:", error);
        }
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
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

/**
 * Check if user profile is complete (has username and avatar)
 */
export function isProfileComplete(user: User | null): boolean {
    return !!(user?.username && user?.avatar_url);
}
