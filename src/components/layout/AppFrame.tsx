"use client";

import { ReactNode } from "react";

interface AppFrameProps {
    sidebar: ReactNode;
    children: ReactNode;
    isSidebarOpen: boolean;
    isOverlay: boolean;
    onCloseSidebar: () => void;
}

export default function AppFrame({
    sidebar,
    children,
    isSidebarOpen,
    isOverlay,
    onCloseSidebar,
}: AppFrameProps) {
    const shouldUseOverlay = isSidebarOpen && isOverlay;

    return (
        <div className="flex h-svh w-screen flex-col">
            {shouldUseOverlay && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 transition-opacity"
                    onClick={onCloseSidebar}
                />
            )}
            <div className="relative z-0 flex min-h-0 w-full flex-1">
                <div className="relative flex min-h-0 w-full flex-1">
                    <aside
                        className={`
                            shrink-0 h-full overflow-hidden transition-all duration-300 ease-in-out
                            ${shouldUseOverlay ? "fixed left-0 top-0 z-50" : "relative"}
                            ${isSidebarOpen ? "w-64" : "w-14"}
                        `}
                    >
                        {sidebar}
                    </aside>

                    <section
                        className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-workspace-bg"
                        style={{ backgroundColor: "var(--workspace-bg)" }}
                    >
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
