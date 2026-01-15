"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarContextType {
    isSidebarOpen: boolean;
    initialMessage: string | null;
    toggleSidebar: () => void;
    openSidebar: (message?: string) => void;
    closeSidebar: () => void;
    clearInitialMessage: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [initialMessage, setInitialMessage] = useState<string | null>(null);

    const toggleSidebar = () => setIsSidebarOpen(prev => !prev);

    const openSidebar = (message?: string) => {
        if (message) setInitialMessage(message);
        setIsSidebarOpen(true);
    };

    const closeSidebar = () => setIsSidebarOpen(false);

    const clearInitialMessage = () => setInitialMessage(null);

    return (
        <SidebarContext.Provider value={{
            isSidebarOpen,
            initialMessage,
            toggleSidebar,
            openSidebar,
            closeSidebar,
            clearInitialMessage
        }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}
