"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Home, Upload, BarChart2, Power, ChevronDown, LogOut, Loader2, Bot, MessageSquare, UserCircle, Zap, Palette } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebar } from '@/context/SidebarContext';

export default function Navbar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const [sessionStatus, setSessionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { toggleSidebar, isSidebarOpen } = useSidebar();

    const navItems = [
        { name: 'Home', href: '/', icon: Home },
        { name: 'Curator', href: '/curator', icon: Palette },
        { name: 'Upload', href: '/upload', icon: Upload },
        { name: 'Analytics', href: '/analyze', icon: BarChart2 },
        { name: 'Feed AI', href: '/feed-ai', icon: Zap },
        { name: 'Profile AI', href: '/profile-chat', icon: Bot },
        { name: 'Chat', href: '/chat', icon: MessageSquare },
        { name: 'Connect', href: '/connect', icon: UserCircle },
    ];


    // Check status on mount and periodic poll
    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [dropdownRef]);

    const checkStatus = async () => {
        try {
            const res = await axios.get('http://localhost:8000/session/status');
            // API returns { status: "connected" | "disconnected" }
            setSessionStatus(res.data.status);
        } catch (err) {
            console.error("Status check failed", err);
            // setSessionStatus('disconnected'); // Optional: don't force disconnect on simple network flake
        }
    };

    const handleStartSession = async () => {
        setLoading(true);
        try {
            await axios.post('http://localhost:8000/session/start');
            setSessionStatus('connected');
            setIsOpen(false);
        } catch (err) {
            console.error("Failed to start session", err);
            alert("Failed to start session. Check console.");
        } finally {
            setLoading(false);
        }
    };

    const handleStopSession = async () => {
        setLoading(true);
        try {
            await axios.post('http://localhost:8000/session/disconnect');
            setSessionStatus('disconnected');
            setIsOpen(false);
        } catch (err) {
            console.error("Failed to stop session", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <nav className="sticky top-6 z-50 mx-auto max-w-5xl px-2">
            <div className="mx-auto px-4 py-2.5 rounded-full glass-panel flex justify-between items-center transition-slow hover:shadow-lg backdrop-blur-xl bg-white/70">

                <div className="flex items-center gap-2">
                    {/* Logo */}
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-teal-200 to-cyan-400 flex items-center justify-center text-teal-800 shadow-md">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-4 h-4">
                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                        </svg>
                    </div>
                    <span className="font-bold text-lg tracking-tight text-gray-800 hidden sm:block">TwitterAI</span>
                </div>

                <div className="flex items-center gap-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        const Icon = item.icon;

                        if (item.name === 'Chat') {
                            return (
                                <button
                                    key={item.href}
                                    onClick={toggleSidebar}
                                    className={clsx(
                                        "relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2",
                                        isSidebarOpen
                                            ? "text-gray-900 bg-white shadow-sm ring-1 ring-gray-100"
                                            : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                                    )}
                                >
                                    <Icon size={16} className={clsx(isSidebarOpen ? "stroke-[2.5px]" : "stroke-[2px]")} />
                                    <span className="hidden sm:inline">{item.name}</span>
                                </button>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={clsx(
                                    "relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2",
                                    isActive
                                        ? "text-gray-900 bg-white shadow-sm ring-1 ring-gray-100"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                                )}
                            >
                                <Icon size={16} className={clsx(isActive ? "stroke-[2.5px]" : "stroke-[2px]")} />
                                <span className="hidden sm:inline">{item.name}</span>
                            </Link>
                        );
                    })}
                </div>

                {/* Session Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className={clsx(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ring-1 ring-inset",
                            sessionStatus === 'connected'
                                ? "bg-green-50 text-green-700 ring-green-200 hover:bg-green-100"
                                : "bg-gray-50 text-gray-600 ring-gray-200 hover:bg-gray-100"
                        )}
                    >
                        {loading ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : sessionStatus === 'connected' ? (
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        ) : (
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                        )}

                        <span className="uppercase tracking-wide">
                            {sessionStatus === 'connected' ? 'Active' : 'Offline'}
                        </span>
                        <ChevronDown size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>

                    <AnimatePresence>
                        {isOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className="absolute right-0 mt-3 w-56 rounded-2xl bg-white shadow-xl ring-1 ring-gray-900/5 p-2 origin-top-right backdrop-blur-xl z-50 overflow-hidden"
                            >
                                <div className="px-3 py-2 border-b border-gray-100 mb-1">
                                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Session Control</p>
                                </div>

                                {sessionStatus !== 'connected' ? (
                                    <button
                                        onClick={handleStartSession}
                                        disabled={loading}
                                        className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-teal-50 hover:text-teal-700 flex items-center gap-3 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600">
                                            <Power size={16} />
                                        </div>
                                        <div>
                                            <div className="text-gray-900 font-semibold">Start Session</div>
                                            <div className="text-xs text-gray-400 font-normal">Launch browser automation</div>
                                        </div>
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStopSession}
                                        disabled={loading}
                                        className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-3 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                                            <LogOut size={16} />
                                        </div>
                                        <div>
                                            <div className="text-gray-900 font-semibold">Stop Session</div>
                                            <div className="text-xs text-gray-400 font-normal">Close browser & disconnect</div>
                                        </div>
                                    </button>
                                )}

                                <div className="mt-1 flex items-center justify-between px-3 py-2 text-[10px] text-gray-400 bg-gray-50/50 rounded-lg mx-1">
                                    <span>Status</span>
                                    <span className={clsx("font-medium", sessionStatus === 'connected' ? "text-green-600" : "text-gray-500")}>
                                        {sessionStatus === 'connected' ? 'Connected' : 'Not Connected'}
                                    </span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </nav>
    );
}
