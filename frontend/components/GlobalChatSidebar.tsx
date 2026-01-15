"use client";

import { useState, useEffect } from 'react';
import { MessageSquare, Settings, ChevronDown, Plus, ToggleLeft, ToggleRight, X, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ChatInterface from '@/components/ChatInterface';
import { useSidebar } from '@/context/SidebarContext';
import { clsx } from 'clsx';

interface Message {
    id: string | number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at?: string;
    model_used?: string;
}

interface Model {
    id: string;
    name: string;
    description: string;
}

export default function GlobalChatSidebar() {
    const { isSidebarOpen, closeSidebar, initialMessage, clearInitialMessage } = useSidebar();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [useProfileContext, setUseProfileContext] = useState(true);
    const [models, setModels] = useState<{ text: Model[]; vision: Model[] }>({ text: [], vision: [] });
    const [selectedModel, setSelectedModel] = useState<string>('qwen-qwq-32b');
    const [showModelSelect, setShowModelSelect] = useState(false);
    const [profileInsights, setProfileInsights] = useState<Record<string, any>>({});
    const [isExpanded, setIsExpanded] = useState(false); // For wider view

    useEffect(() => {
        if (isSidebarOpen) {
            // Load data when sidebar opens if not already loaded
            if (models.text.length === 0) loadModels();
            loadSettings();
            loadProfileInsights();
            if (!sessionId) startNewSession();

            // Handle initial message from external trigger
            if (initialMessage) {
                // We wrap in timeout to ensure state is ready and it feels natural
                setTimeout(() => {
                    handleSendMessage(initialMessage);
                    clearInitialMessage();
                }, 500);
            }
        }
    }, [isSidebarOpen, initialMessage]);

    const loadModels = async () => {
        try {
            const res = await axios.get('http://localhost:8000/chat/models');
            setModels(res.data.models);
        } catch (err) {
            console.error("Failed to load models", err);
        }
    };

    const loadSettings = async () => {
        try {
            const res = await axios.get('http://localhost:8000/chat/settings');
            setUseProfileContext(Boolean(res.data.use_profile_context));
            setSelectedModel(res.data.default_text_model || 'qwen-qwq-32b');
        } catch (err) {
            console.error("Failed to load settings", err);
        }
    };

    const loadProfileInsights = async () => {
        try {
            const res = await axios.get('http://localhost:8000/chat/profile/insights');
            setProfileInsights(res.data.insights || {});
        } catch (err) {
            console.error("Failed to load insights", err);
        }
    };

    const startNewSession = async () => {
        try {
            const res = await axios.post('http://localhost:8000/chat/general/new-session');
            setSessionId(res.data.session_id);
            setMessages([]);
        } catch (err) {
            console.error("Failed to start session", err);
            setSessionId(`local-${Date.now()}`);
        }
    };

    const toggleProfileContext = async () => {
        const newValue = !useProfileContext;
        setUseProfileContext(newValue);

        try {
            await axios.post('http://localhost:8000/chat/settings', {
                use_profile_context: newValue
            });
        } catch (err) {
            console.error("Failed to update setting", err);
        }
    };

    const handleSendMessage = async (message: string, imageData?: string) => {
        const userMsg: Message = {
            id: Date.now(),
            role: 'user',
            content: message
        };
        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);

        try {
            const res = await axios.post('http://localhost:8000/chat/general', {
                message,
                session_id: sessionId,
                image_data: imageData,
                model: selectedModel,
                use_profile_context: useProfileContext
            });

            if (res.data.session_id && !sessionId) {
                setSessionId(res.data.session_id);
            }

            const assistantMsg: Message = {
                id: Date.now() + 1,
                role: 'assistant',
                content: res.data.response,
                model_used: res.data.model_used
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err: any) {
            console.error("Chat error", err);
            const errorMsg: Message = {
                id: Date.now() + 1,
                role: 'assistant',
                content: `Error: ${err.response?.data?.detail || 'Failed to get response'}`
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const hasProfileContext = Object.keys(profileInsights).length > 0;

    return (
        <AnimatePresence>
            {isSidebarOpen && (
                <>
                    {/* Backdrop for mobile mostly, but helpful for focus */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.2 }}
                        exit={{ opacity: 0 }}
                        onClick={closeSidebar}
                        className="fixed inset-0 bg-black z-[90] lg:hidden"
                    />

                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className={clsx(
                            "fixed top-0 right-0 h-full bg-white shadow-2xl z-[100] border-l border-gray-200 flex flex-col transition-all duration-300",
                            isExpanded ? "w-full md:w-[800px]" : "w-full md:w-[450px]"
                        )}
                    >
                        {/* Header */}
                        <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-teal-50/50 to-cyan-50/50 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white shadow-sm">
                                    <MessageSquare size={16} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900">AI Assistant</h2>
                                    <div className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                        <span className="text-[10px] text-gray-500 font-medium">Online</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors hidden md:block"
                                    title={isExpanded ? "Collapse" : "Expand"}
                                >
                                    {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                                <button
                                    onClick={closeSidebar}
                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Controls Toolbar */}
                        <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/30 flex items-center gap-2 justify-between shrink-0">
                            <div className="flex items-center gap-2">
                                {/* Model Selector */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowModelSelect(!showModelSelect)}
                                        className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 text-gray-700"
                                    >
                                        <Settings size={12} />
                                        <span className="max-w-[80px] truncate">{models.text.find(m => m.id === selectedModel)?.name || selectedModel}</span>
                                        <ChevronDown size={12} />
                                    </button>

                                    <AnimatePresence>
                                        {showModelSelect && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 p-1 z-[200] origin-top-left"
                                            >
                                                <div className="text-[10px] font-semibold text-gray-400 px-2 py-1 uppercase border-b border-gray-50 mb-1">Select Model</div>
                                                <div className="max-h-[200px] overflow-y-auto">
                                                    {models.text.map(model => (
                                                        <button
                                                            key={model.id}
                                                            onClick={() => { setSelectedModel(model.id); setShowModelSelect(false); }}
                                                            className={clsx(
                                                                "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors mb-0.5",
                                                                selectedModel === model.id ? 'bg-teal-50 text-teal-700 font-medium' : 'hover:bg-gray-50 text-gray-700'
                                                            )}
                                                        >
                                                            <div className="truncate">{model.name}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <div className="h-4 w-px bg-gray-200"></div>

                                {/* Context Toggle */}
                                <button
                                    onClick={toggleProfileContext}
                                    disabled={!hasProfileContext}
                                    className={clsx(
                                        "flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium border rounded shadow-sm transition-colors",
                                        useProfileContext && hasProfileContext
                                            ? "bg-teal-50 border-teal-200 text-teal-700"
                                            : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50",
                                        !hasProfileContext && "opacity-50 cursor-not-allowed"
                                    )}
                                    title={hasProfileContext ? "Toggle profile context" : "No profile insights available"}
                                >
                                    <Sparkles size={12} className={useProfileContext && hasProfileContext ? "text-teal-500" : "text-gray-400"} />
                                    <span>Context</span>
                                </button>
                            </div>

                            <button
                                onClick={startNewSession}
                                className="p-1 px-2 text-[10px] bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors flex items-center gap-1 shrink-0 shadow-sm"
                            >
                                <Plus size={12} />
                                New
                            </button>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 overflow-hidden relative bg-gray-50/30">
                            <ChatInterface
                                messages={messages}
                                onSendMessage={handleSendMessage}
                                isLoading={isLoading}
                                placeholder="Ask about strategy, tweets..."
                                showImageUpload={true}
                                accentColor="teal"
                                emptyStateMessage="How can I help you today?"
                            />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
