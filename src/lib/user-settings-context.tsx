"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { getMySettings, updateMySettings } from "@/lib/api";

const USER_SETTINGS_STORAGE_KEY = "user_settings_v1";
const DEFAULT_MESSAGE_FONT_SIZE = 16;
const MIN_MESSAGE_FONT_SIZE = 14;
const MAX_MESSAGE_FONT_SIZE = 24;
const SETTINGS_SYNC_DEBOUNCE_MS = 400;

interface UserSettingsContextType {
    messageFontSize: number;
    setMessageFontSize: (size: number) => void;
    minMessageFontSize: number;
    maxMessageFontSize: number;
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    retrySync: () => Promise<void>;
}

const UserSettingsContext = createContext<UserSettingsContextType | undefined>(
    undefined
);

const clampMessageFontSize = (size: number): number => {
    if (Number.isNaN(size)) return DEFAULT_MESSAGE_FONT_SIZE;
    return Math.min(MAX_MESSAGE_FONT_SIZE, Math.max(MIN_MESSAGE_FONT_SIZE, Math.round(size)));
};

const saveToLocalStorage = (messageFontSize: number) => {
    try {
        window.localStorage.setItem(
            USER_SETTINGS_STORAGE_KEY,
            JSON.stringify({ messageFontSize })
        );
    } catch {
        // Ignore localStorage write failures and continue.
    }
};

export function UserSettingsProvider({ children }: { children: ReactNode }) {
    const [messageFontSize, setMessageFontSizeState] = useState(DEFAULT_MESSAGE_FONT_SIZE);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [changeVersion, setChangeVersion] = useState(0);

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const syncMessageFontSize = useCallback(async (size: number) => {
        setIsSaving(true);
        try {
            await updateMySettings({ message_font_size: size });
            setError(null);
        } catch {
            setError("未同步到云端，可重试");
        } finally {
            setIsSaving(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;

        const bootstrap = async () => {
            try {
                const raw = window.localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
                if (raw) {
                    const parsed = JSON.parse(raw) as { messageFontSize?: number };
                    if (typeof parsed.messageFontSize === "number") {
                        setMessageFontSizeState(clampMessageFontSize(parsed.messageFontSize));
                    }
                }
            } catch {
                // Ignore malformed/blocked local storage reads.
            }

            try {
                const remote = await getMySettings();
                if (!cancelled) {
                    const next = clampMessageFontSize(remote.message_font_size);
                    setMessageFontSizeState(next);
                    saveToLocalStorage(next);
                    setError(null);
                }
            } catch {
                if (!cancelled) {
                    setError("设置同步失败，已使用本地配置");
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        void bootstrap();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (isLoading) return;
        saveToLocalStorage(messageFontSize);
    }, [isLoading, messageFontSize]);

    useEffect(() => {
        if (changeVersion === 0) return;
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null;
            void syncMessageFontSize(messageFontSize);
        }, SETTINGS_SYNC_DEBOUNCE_MS);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
        };
    }, [changeVersion, messageFontSize, syncMessageFontSize]);

    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const setMessageFontSize = useCallback((size: number) => {
        setMessageFontSizeState(clampMessageFontSize(size));
        setChangeVersion((version) => version + 1);
    }, []);

    const retrySync = useCallback(async () => {
        await syncMessageFontSize(messageFontSize);
    }, [messageFontSize, syncMessageFontSize]);

    const contextValue = useMemo(
        () => ({
            messageFontSize,
            setMessageFontSize,
            minMessageFontSize: MIN_MESSAGE_FONT_SIZE,
            maxMessageFontSize: MAX_MESSAGE_FONT_SIZE,
            isLoading,
            isSaving,
            error,
            retrySync,
        }),
        [error, isLoading, isSaving, messageFontSize, retrySync, setMessageFontSize]
    );

    return (
        <UserSettingsContext.Provider value={contextValue}>
            {children}
        </UserSettingsContext.Provider>
    );
}

export function useUserSettings() {
    const context = useContext(UserSettingsContext);
    if (!context) {
        throw new Error("useUserSettings must be used within a UserSettingsProvider");
    }
    return context;
}
