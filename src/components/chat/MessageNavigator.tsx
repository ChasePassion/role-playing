"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import type { Message } from "@/components/ChatMessage";
import { cn } from "@/lib/utils";

interface MessageNavigatorProps {
  messages: Message[];
  scrollRootRef: RefObject<HTMLDivElement | null>;
  isSidebarOpen?: boolean;
  className?: string;
}

interface NavigatorViewport {
  top: number;
  right: number;
  maxHeight: number;
  ready: boolean;
}

interface NavigatorItem {
  id: string;
  label: string;
  preview: string;
}

const COLLAPSED_WIDTH = 44;
const EXPANDED_WIDTH = 240;
const EDGE_OFFSET = 4;
const HOVER_PREVIEW_DELAY = 600;
const ITEM_HEIGHT = 38;
const HIGHLIGHT_SYNC_TOP_OFFSET = 20;
const CLICK_SCROLL_TOP_GAP = 16;
const CLICK_HIGHLIGHT_LOCK_MS = 400;
const MIN_MESSAGES = 3;
const NAVIGATOR_MAX_HEIGHT = 360;
const PREVIEW_GAP = 12;
const PREVIEW_MAX_WIDTH = 320;
const VIEWPORT_PADDING = 32;

function normalizeNavigatorLabel(content: string): string {
  const compactContent = content.replace(/\s+/g, " ").trim();
  return compactContent.length > 0 ? compactContent : "空白消息";
}

export default function MessageNavigator({
  messages,
  scrollRootRef,
  isSidebarOpen = true,
  className,
}: MessageNavigatorProps) {
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [previewTop, setPreviewTop] = useState(0);
  const [viewport, setViewport] = useState<NavigatorViewport>({
    top: 0,
    right: EDGE_OFFSET,
    maxHeight: 320,
    ready: false,
  });

  const hoverPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightSyncFrameRef = useRef<number | null>(null);
  const clickedAtRef = useRef(0);
  const clickedMessageIdRef = useRef<string | null>(null);
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const userMessages = useMemo(
    () => messages.filter((message) => message.role === "user" && !message.isTemp),
    [messages]
  );

  const navigationItems = useMemo<NavigatorItem[]>(
    () =>
      userMessages.map((message) => {
        const normalizedLabel = normalizeNavigatorLabel(message.content);
        return {
          id: message.id,
          label: normalizedLabel,
          preview: message.content.trim().length > 0 ? message.content : normalizedLabel,
        };
      }),
    [userMessages]
  );

  const clearHoverPreviewTimer = useCallback(() => {
    if (!hoverPreviewTimerRef.current) {
      return;
    }

    clearTimeout(hoverPreviewTimerRef.current);
    hoverPreviewTimerRef.current = null;
  }, []);

  const resetHoverState = useCallback(() => {
    clearHoverPreviewTimer();
    setHoveredIndex(null);
    setPreviewItemId(null);
  }, [clearHoverPreviewTimer]);

  useEffect(() => {
    return () => {
      clearHoverPreviewTimer();
      if (highlightSyncFrameRef.current !== null) {
        cancelAnimationFrame(highlightSyncFrameRef.current);
      }
    };
  }, [clearHoverPreviewTimer]);

  const getMessageElement = useCallback(
    (messageId: string) => {
      return scrollRootRef.current?.querySelector<HTMLElement>(
        `[data-turn-id="${messageId}"]`
      ) ?? null;
    },
    [scrollRootRef]
  );

  const getHeaderOffset = useCallback((root: HTMLDivElement) => {
    const headerHeightValue = window
      .getComputedStyle(root)
      .getPropertyValue("--header-height")
      .trim();
    const headerHeight = Number.parseFloat(headerHeightValue);
    return Number.isFinite(headerHeight) ? headerHeight : 0;
  }, []);

  const getScrollBehavior = useCallback((): ScrollBehavior => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return "auto";
    }

    return "smooth";
  }, []);

  const syncCurrentMessageIndex = useCallback(() => {
    const root = scrollRootRef.current;
    if (!root || navigationItems.length === 0) {
      return;
    }

    const clickedMessageId = clickedMessageIdRef.current;
    if (
      clickedMessageId &&
      Date.now() - clickedAtRef.current < CLICK_HIGHLIGHT_LOCK_MS
    ) {
      const clickedIndex = navigationItems.findIndex(
        (item) => item.id === clickedMessageId
      );
      if (clickedIndex !== -1) {
        setCurrentMessageIndex((previous) =>
          previous === clickedIndex ? previous : clickedIndex
        );
        return;
      }
    }

    const activationLine =
      root.getBoundingClientRect().top +
      getHeaderOffset(root) +
      HIGHLIGHT_SYNC_TOP_OFFSET;
    let nextIndex = 0;

    navigationItems.forEach((item, index) => {
      const element = getMessageElement(item.id);
      if (!element) {
        return;
      }

      if (index === 0) {
        nextIndex = 0;
      }

      if (element.getBoundingClientRect().top <= activationLine) {
        nextIndex = index;
      }
    });

    setCurrentMessageIndex((previous) =>
      previous === nextIndex ? previous : nextIndex
    );
  }, [getHeaderOffset, getMessageElement, navigationItems, scrollRootRef]);

  const scheduleCurrentMessageSync = useCallback(() => {
    if (highlightSyncFrameRef.current !== null) {
      cancelAnimationFrame(highlightSyncFrameRef.current);
    }

    highlightSyncFrameRef.current = requestAnimationFrame(() => {
      highlightSyncFrameRef.current = null;
      syncCurrentMessageIndex();
    });
  }, [syncCurrentMessageIndex]);

  useEffect(() => {
    const root = scrollRootRef.current;
    if (!root) {
      return;
    }

    const updateViewport = () => {
      const rect = root.getBoundingClientRect();
      const scrollbarWidth = Math.max(0, root.offsetWidth - root.clientWidth);
      const rightInset =
        window.innerWidth - rect.right + EDGE_OFFSET + scrollbarWidth;

      if (rect.width === 0 || rect.height === 0) {
        setViewport((previous) =>
          previous.ready ? { ...previous, ready: false } : previous
        );
        return;
      }

      setViewport({
        top: rect.top + rect.height / 2,
        right: Math.max(rightInset, EDGE_OFFSET),
        maxHeight: Math.max(220, rect.height - VIEWPORT_PADDING * 2),
        ready: true,
      });
    };

    updateViewport();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            updateViewport();
          });

    resizeObserver?.observe(root);
    window.addEventListener("resize", updateViewport);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateViewport);
    };
  }, [isSidebarOpen, navigationItems.length, scrollRootRef]);

  useEffect(() => {
    if (navigationItems.length === 0) {
      setCurrentMessageIndex(0);
      return;
    }

    setCurrentMessageIndex((previous) =>
      Math.min(previous, navigationItems.length - 1)
    );
  }, [navigationItems.length]);

  useEffect(() => {
    const scrollRoot = scrollRootRef.current;
    if (!scrollRoot || navigationItems.length === 0) {
      return;
    }

    scheduleCurrentMessageSync();

    scrollRoot.addEventListener("scroll", scheduleCurrentMessageSync, {
      passive: true,
    });
    window.addEventListener("resize", scheduleCurrentMessageSync);

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            scheduleCurrentMessageSync();
          });

    resizeObserver?.observe(scrollRoot);

    return () => {
      scrollRoot.removeEventListener("scroll", scheduleCurrentMessageSync);
      window.removeEventListener("resize", scheduleCurrentMessageSync);
      resizeObserver?.disconnect();

      if (highlightSyncFrameRef.current !== null) {
        cancelAnimationFrame(highlightSyncFrameRef.current);
        highlightSyncFrameRef.current = null;
      }
    };
  }, [navigationItems, scheduleCurrentMessageSync, scrollRootRef]);

  useEffect(() => {
    const activeItem = navigationItems[currentMessageIndex];
    if (!activeItem) {
      return;
    }

    itemRefs.current.get(activeItem.id)?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [currentMessageIndex, navigationItems]);

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const root = scrollRootRef.current;
      const element = getMessageElement(messageId);
      if (!root || !element) {
        return;
      }

      clickedMessageIdRef.current = messageId;
      clickedAtRef.current = Date.now();

      const clickedIndex = navigationItems.findIndex(
        (item) => item.id === messageId
      );
      if (clickedIndex !== -1) {
        setCurrentMessageIndex((previous) =>
          previous === clickedIndex ? previous : clickedIndex
        );
      }

      const rootRect = root.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const targetTop =
        root.scrollTop +
        (elementRect.top - rootRect.top) -
        getHeaderOffset(root) -
        CLICK_SCROLL_TOP_GAP;

      root.scrollTo({
        top: Math.max(0, targetTop),
        behavior: getScrollBehavior(),
      });

      scheduleCurrentMessageSync();
    },
    [getHeaderOffset, getMessageElement, getScrollBehavior, navigationItems, scheduleCurrentMessageSync, scrollRootRef]
  );

  const focusItem = useCallback(
    (index: number) => {
      const targetItem = navigationItems[index];
      if (!targetItem) {
        return;
      }

      itemRefs.current.get(targetItem.id)?.focus();
    },
    [navigationItems]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (navigationItems.length === 0) {
        return;
      }

      const pressedKey = event.key;
      const targetElement = event.target instanceof Element ? event.target : null;
      const targetButton = targetElement?.closest("[data-navigator-index]");
      const targetIndex =
        targetButton instanceof HTMLElement
          ? Number(targetButton.getAttribute("data-navigator-index"))
          : Number.NaN;
      const startIndex = Number.isFinite(targetIndex)
        ? targetIndex
        : currentMessageIndex;

      if (pressedKey === "Enter" || pressedKey === " ") {
        if (event.target === event.currentTarget) {
          event.preventDefault();
          const activeItem = navigationItems[currentMessageIndex];
          if (activeItem) {
            scrollToMessage(activeItem.id);
          }
        }
        return;
      }

      let nextIndex = startIndex;

      if (pressedKey === "ArrowDown") {
        nextIndex = Math.min(startIndex + 1, navigationItems.length - 1);
      } else if (pressedKey === "ArrowUp") {
        nextIndex = Math.max(startIndex - 1, 0);
      } else if (pressedKey === "Home") {
        nextIndex = 0;
      } else if (pressedKey === "End") {
        nextIndex = navigationItems.length - 1;
      } else {
        return;
      }

      event.preventDefault();
      focusItem(nextIndex);
    },
    [currentMessageIndex, focusItem, navigationItems, scrollToMessage]
  );

  const handleNavigatorEnter = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleNavigatorLeave = useCallback(() => {
    setIsExpanded(false);
    resetHoverState();
  }, [resetHoverState]);

  const handleItemEnter = useCallback(
    (
      index: number,
      item: NavigatorItem,
      event: MouseEvent<HTMLButtonElement>
    ) => {
      const buttonRect = event.currentTarget.getBoundingClientRect();
      const navigatorRoot = event.currentTarget.closest("[data-message-navigator-root]");
      const navigatorRect = navigatorRoot?.getBoundingClientRect();

      setHoveredIndex(index);
      setPreviewTop(
        navigatorRect
          ? buttonRect.top - navigatorRect.top + buttonRect.height / 2
          : buttonRect.top + buttonRect.height / 2
      );
      clearHoverPreviewTimer();
      setPreviewItemId(null);

      if (index === currentMessageIndex) {
        return;
      }

      hoverPreviewTimerRef.current = setTimeout(() => {
        setPreviewItemId(item.id);
      }, HOVER_PREVIEW_DELAY);
    },
    [clearHoverPreviewTimer, currentMessageIndex]
  );

  if (navigationItems.length < MIN_MESSAGES || !viewport.ready) {
    return null;
  }

  const previewItem =
    previewItemId === null
      ? null
      : navigationItems.find((item) => item.id === previewItemId) ?? null;

  const panelHeight = Math.min(
    navigationItems.length * ITEM_HEIGHT,
    viewport.maxHeight,
    NAVIGATOR_MAX_HEIGHT
  );

  return (
    <aside
      className={cn("fixed z-30", className)}
      data-message-navigator-root
      style={{
        top: `${viewport.top}px`,
        right: `${viewport.right}px`,
        transform: "translateY(-50%)",
      }}
      aria-label="消息导航"
      onMouseEnter={handleNavigatorEnter}
      onMouseLeave={handleNavigatorLeave}
    >
        <div
          className={cn(
            "relative overflow-hidden transition-[width,background-color,border-color,box-shadow] duration-220 ease-out",
            isExpanded
              ? "rounded-[24px] border border-black/6 bg-white/96 shadow-[0_18px_48px_rgba(15,23,42,0.12)] backdrop-blur-xl"
              : "rounded-[20px] border border-transparent bg-transparent shadow-none"
        )}
        style={{
          width: `${isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH}px`,
          maxHeight: `${panelHeight}px`,
        }}
      >
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-white via-white/90 to-transparent transition-opacity duration-150",
            isExpanded ? "h-11 opacity-100" : "h-0 opacity-0"
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white/90 to-transparent transition-opacity duration-150",
            isExpanded ? "h-11 opacity-100" : "h-0 opacity-0"
          )}
        />

        <div
          className={cn(
            "message-navigator-scroll relative overflow-y-auto outline-none",
            !isExpanded && "message-navigator-scroll-collapsed"
          )}
          style={{ maxHeight: `${panelHeight}px` }}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <div className="flex flex-col">
            {navigationItems.map((item, index) => {
              const isCurrent = index === currentMessageIndex;
              const isHovered = hoveredIndex === index;
              const showHoveredState = isHovered && !isCurrent;

              return (
                <button
                  key={item.id}
                  ref={(element) => {
                    if (element) {
                      itemRefs.current.set(item.id, element);
                    } else {
                      itemRefs.current.delete(item.id);
                    }
                  }}
                  type="button"
                  data-navigator-index={index}
                  aria-current={isCurrent ? "true" : undefined}
                  aria-label={`跳转到第 ${index + 1} 条用户消息`}
                  onClick={() => scrollToMessage(item.id)}
                  onMouseEnter={(event) => handleItemEnter(index, item, event)}
                  className={cn(
                    "group relative flex h-[34px] w-full items-center rounded-[14px] text-left outline-none transition-colors duration-150",
                    isCurrent
                      ? "bg-transparent"
                      : showHoveredState
                        ? "bg-transparent"
                        : "bg-transparent",
                    "focus-visible:ring-2 focus-visible:ring-[#3964FE]/20"
                  )}
                >
                  <div className="min-w-0 flex-1 overflow-hidden pr-11">
                    <div
                      className={cn(
                        "min-w-0 overflow-hidden whitespace-nowrap text-[13px] leading-5 transition-[opacity,color,transform,max-width,padding] duration-180",
                        isExpanded
                          ? "max-w-full translate-x-0 px-3 opacity-100"
                          : "max-w-0 translate-x-0 px-0 opacity-0",
                        isCurrent
                          ? "font-medium text-[#3964FE]"
                          : showHoveredState
                            ? "text-[#111111]"
                            : "text-[#8F8F8F]"
                      )}
                    >
                      <div className="block truncate">{item.label}</div>
                    </div>
                  </div>

                  <div className="pointer-events-none absolute inset-y-0 right-0 flex w-[44px] items-center justify-end pr-[2px]">
                    <span
                      className={cn(
                        "rounded-full transition-[width,background-color] duration-150",
                        isCurrent
                          ? "h-1.5 w-5 bg-[#3964FE]"
                          : showHoveredState
                            ? "h-1 w-4 bg-[#111111]"
                            : "h-0.5 w-3 bg-black/20"
                      )}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isExpanded && previewItem && hoveredIndex !== currentMessageIndex ? (
        <div
          className="absolute z-10"
          style={{
            top: `${previewTop}px`,
            right: "100%",
            transform: "translateY(-50%)",
            width: `calc(min(${PREVIEW_MAX_WIDTH}px, 42vw) + ${PREVIEW_GAP}px)`,
          }}
        >
          <div
            className="rounded-[18px] bg-[#1F1F1F] px-3 py-2 text-white shadow-[0_14px_30px_rgba(0,0,0,0.22)]"
            style={{ width: `min(${PREVIEW_MAX_WIDTH}px, 42vw)` }}
          >
            <p className="message-navigator-preview-scroll max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words text-[13px] leading-6">
              {previewItem.preview}
            </p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
