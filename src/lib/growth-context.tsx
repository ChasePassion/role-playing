"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./auth-context";
import type {
  GrowthTodaySummary,
  GrowthPopup,
  GrowthShareCard,
  GrowthCalendarMonth,
  GrowthCalendarDay,
} from "./growth-types";
import { consumeGrowthEntry, listPendingShareCards } from "./growth-api";
import {
  dismissGrowthEntryForToday as persistGrowthEntryDismissal,
  readGrowthEntryDismissedStatDate,
  shouldEvaluateGrowthEntryAutoOpenForSession,
  shouldAutoOpenGrowthEntryPopup,
} from "./growth-entry-prompt";

// ── Context shape ──

interface GrowthContextType {
  todaySummary: GrowthTodaySummary | null;

  isEntryPopupVisible: boolean;
  entryPopupData: GrowthPopup | null;
  closeEntryPopup: () => void;
  dismissEntryPopupForToday: () => void;
  refreshGrowthEntry: (options?: { autoOpenPopup?: boolean }) => Promise<void>;

  updateTodaySummary: (today: GrowthTodaySummary) => void;

  pendingShareCards: GrowthShareCard[];
  enqueueShareCard: (card: GrowthShareCard) => void;
  dismissShareCard: (triggerId: string) => void;

  makeupCardBalance: number;

  calendarMonth: GrowthCalendarMonth | null;
  updateCalendarDay: (day: GrowthCalendarDay) => void;
  updateMakeupCardBalance: (balance: number) => void;
}

const GrowthContext = createContext<GrowthContextType | null>(null);

export function useGrowth(): GrowthContextType {
  const ctx = useContext(GrowthContext);
  if (!ctx) {
    throw new Error("useGrowth must be used within GrowthProvider");
  }
  return ctx;
}

// ── Provider ──

export function GrowthProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [todaySummary, setTodaySummary] = useState<GrowthTodaySummary | null>(
    null,
  );
  const [isEntryPopupVisible, setIsEntryPopupVisible] = useState(false);
  const [entryPopupData, setEntryPopupData] = useState<GrowthPopup | null>(
    null,
  );
  const [pendingShareCards, setPendingShareCards] = useState<GrowthShareCard[]>(
    [],
  );
  const [calendarMonth, setCalendarMonth] =
    useState<GrowthCalendarMonth | null>(null);
  const lastHandledAutoOpenStatDateRef = useRef<string | null>(null);

  useEffect(() => {
    setIsEntryPopupVisible(false);
    setEntryPopupData(null);
    setCalendarMonth(null);
    setTodaySummary(null);
    lastHandledAutoOpenStatDateRef.current = null;

    if (!user?.id) {
      setPendingShareCards([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    async function restorePendingShareCards() {
      try {
        const pendingRes = await listPendingShareCards({ limit: 10 });
        if (cancelled) return;
        setPendingShareCards(pendingRes.items);
      } catch (pendingErr) {
        console.error("Failed to restore pending share cards:", pendingErr);
      }
    }

    void restorePendingShareCards();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const refreshGrowthEntry = useCallback(
    async (options?: { autoOpenPopup?: boolean }) => {
      if (!user?.id) {
        return;
      }

      const data = await consumeGrowthEntry();
      setTodaySummary(data.today);
      setEntryPopupData(data.popup);
      setCalendarMonth(data.popup.calendar);

      if (!options?.autoOpenPopup) {
        return;
      }

      if (
        !shouldEvaluateGrowthEntryAutoOpenForSession({
          statDate: data.today.stat_date,
          lastHandledStatDate: lastHandledAutoOpenStatDateRef.current,
        })
      ) {
        return;
      }

      lastHandledAutoOpenStatDateRef.current = data.today.stat_date;
      const dismissedStatDate = readGrowthEntryDismissedStatDate(user.id);
      setIsEntryPopupVisible(
        shouldAutoOpenGrowthEntryPopup({
          statDate: data.today.stat_date,
          dismissedStatDate,
        }),
      );
    },
    [user?.id],
  );

  const closeEntryPopup = useCallback(() => {
    setIsEntryPopupVisible(false);
  }, []);

  const dismissEntryPopupForToday = useCallback(() => {
    if (todaySummary?.stat_date) {
      persistGrowthEntryDismissal(todaySummary.stat_date, user?.id);
    }
    setIsEntryPopupVisible(false);
  }, [todaySummary?.stat_date, user?.id]);

  const updateTodaySummary = useCallback((today: GrowthTodaySummary) => {
    setTodaySummary(today);
  }, []);

  const enqueueShareCard = useCallback((card: GrowthShareCard) => {
    setPendingShareCards((prev) => {
      if (prev.some((c) => c.id === card.id)) return prev;
      return [...prev, card];
    });
  }, []);

  const dismissShareCard = useCallback((triggerId: string) => {
    setPendingShareCards((prev) => prev.filter((c) => c.id !== triggerId));
  }, []);

  const updateCalendarDay = useCallback((day: GrowthCalendarDay) => {
    setCalendarMonth((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((d) => (d.date === day.date ? day : d)),
      };
    });
  }, []);

  const updateMakeupCardBalance = useCallback((balance: number) => {
    setTodaySummary((prev) =>
      prev ? { ...prev, makeup_card_balance: balance } : prev,
    );
  }, []);

  const makeupCardBalance = todaySummary?.makeup_card_balance ?? 0;

  return (
    <GrowthContext.Provider
      value={{
        todaySummary,
        isEntryPopupVisible,
        entryPopupData,
        closeEntryPopup,
        dismissEntryPopupForToday,
        refreshGrowthEntry,
        updateTodaySummary,
        pendingShareCards,
        enqueueShareCard,
        dismissShareCard,
        makeupCardBalance,
        calendarMonth,
        updateCalendarDay,
        updateMakeupCardBalance,
      }}
    >
      {children}
    </GrowthContext.Provider>
  );
}
