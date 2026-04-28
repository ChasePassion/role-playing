"use client";

import {
    createContext,
    useContext,
    useCallback,
    useMemo,
    type ReactNode,
} from "react";
import type { User, UserEntitlementsResponse } from "./api-service";
import { authClient } from "./auth-client";
import { mapBetterAuthSessionToUser } from "./auth-user-mapper";
import { clearBetterAuthJwt } from "./better-auth-token";
import { useUserEntitlementsQuery } from "./query";
import { useQueryClient } from "@tanstack/react-query";

interface AuthContextType {
    user: User | null;
    entitlements: UserEntitlementsResponse | null;
    isAuthed: boolean;
    isLoading: boolean;
    isEntitlementsLoading: boolean;
    login: (email: string, code: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    refreshEntitlements: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const {
        data: session,
        isPending,
        refetch,
    } = authClient.useSession();

    const user = useMemo(() => mapBetterAuthSessionToUser(session), [session]);
    const userId = user?.id ?? null;
    const isAuthed = !!user;
    const {
        data: entitlementsData,
        isLoading: isEntitlementsQueryLoading,
        isFetching: isEntitlementsFetching,
        refetch: refetchEntitlements,
    } = useUserEntitlementsQuery(userId);
    const entitlements = entitlementsData ?? null;
    const isEntitlementsLoading =
        Boolean(userId) && (isEntitlementsQueryLoading || isEntitlementsFetching);

    const refreshEntitlements = useCallback(async () => {
        if (!userId) {
            return;
        }

        await refetchEntitlements();
    }, [refetchEntitlements, userId]);

    const login = useCallback(
        async (email: string, code: string) => {
            const result = await authClient.signIn.emailOtp({
                email,
                otp: code,
            });

            if (result.error) {
                throw new Error(result.error.message || "验证码登录失败");
            }

            clearBetterAuthJwt();
            queryClient.clear();
            await refetch();
        },
        [queryClient, refetch],
    );

    const logout = useCallback(
        async () => {
            const result = await authClient.signOut();
            if (result.error) {
                throw new Error(result.error.message || "退出登录失败");
            }

            clearBetterAuthJwt();
            queryClient.clear();
            await refetch();
        },
        [queryClient, refetch],
    );

    const refreshUser = useCallback(
        async () => {
            clearBetterAuthJwt();
            const result = await authClient.getSession();
            if (result.error) {
                throw new Error(result.error.message || "刷新用户信息失败");
            }

            await refetch();
            await refreshEntitlements();
        },
        [refetch, refreshEntitlements],
    );

    const authContextValue = useMemo(
        () => ({
            user,
            entitlements,
            isAuthed,
            isLoading: isPending,
            isEntitlementsLoading,
            login,
            logout,
            refreshUser,
            refreshEntitlements,
        }),
        [
            user,
            entitlements,
            isAuthed,
            isPending,
            isEntitlementsLoading,
            login,
            logout,
            refreshUser,
            refreshEntitlements,
        ],
    );

    return (
        <AuthContext.Provider value={authContextValue}>
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
