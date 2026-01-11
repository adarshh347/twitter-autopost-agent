"use client";

import { useState, useEffect } from 'react';
import { MessageSquare, Settings, ChevronDown, Plus, ToggleLeft, ToggleRight, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import ChatInterface from '@/components/ChatInterface';

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

export default function GeneralChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [useProfileContext, setUseProfileContext] = useState(true);
    const [models, setModels] = useState<{ text: Model[]; vision: Model[] }>({ text: [], vision: [] });
    const [selectedModel, setSelectedModel] = useState<string>('qwen-qwq-32b');
    const [showModelSelect, setShowModelSelect] = useState(false);
    const [profileInsights, setProfileInsights] = useState<Record<string, any>>({});

    useEffect(() => {
        loadModels();
        loadSettings();
        loadProfileInsights();
        startNewSession();
    }, []);

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
        // Optimistically add user message
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

            // Update session ID if returned
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
        <div className="min-h-screen pt-24 pb-8 px-4 md:px-6 max-w-6xl mx-auto">
            <div className="glass-panel rounded-3xl overflow-hidden h-[calc(100vh-140px)] flex flex-col">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-teal-50 to-cyan-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white shadow-lg">
                            <MessageSquare size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">Chat Assistant</h1>
                            <p className="text-xs text-gray-500">
                                {useProfileContext && hasProfileContext
                                    ? "Using your profile context"
                                    : "General Twitter assistance"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Profile Context Toggle */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                            <span className="text-xs text-gray-500">Profile Memory</span>
                            <button
                                onClick={toggleProfileContext}
                                disabled={!hasProfileContext}
                                className={`transition-colors ${!hasProfileContext ? 'opacity-40 cursor-not-allowed' : ''}`}
                                title={hasProfileContext ? "Toggle profile context" : "No profile insights saved yet"}
                            >
                                {useProfileContext ? (
                                    <ToggleRight size={24} className="text-teal-500" />
                                ) : (
                                    <ToggleLeft size={24} className="text-gray-400" />
                                )}
                            </button>
                        </div>

                        {/* Model Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setShowModelSelect(!showModelSelect)}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                            >
                                <Settings size={14} />
                                {models.text.find(m => m.id === selectedModel)?.name || selectedModel}
                                <ChevronDown size={14} />
                            </button>

                            <AnimatePresence>
                                {showModelSelect && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50"
                                    >
                                        <div className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase">Text Models</div>
                                        {models.text.map(model => (
                                            <button
                                                key={model.id}
                                                onClick={() => { setSelectedModel(model.id); setShowModelSelect(false); }}
                                                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedModel === model.id ? 'bg-teal-50 text-teal-700' : 'hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div className="font-medium">{model.name}</div>
                                                <div className="text-xs text-gray-400">{model.description}</div>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* New Chat Button */}
                        <button
                            onClick={startNewSession}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            <Plus size={14} />
                            New Chat
                        </button>
                    </div>
                </div>

                {/* Profile Context Banner */}
                <AnimatePresence>
                    {useProfileContext && hasProfileContext && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="px-6 py-2 bg-teal-50 border-b border-teal-100 flex items-center gap-2 text-xs text-teal-700"
                        >
                            <Sparkles size={12} />
                            <span className="font-medium">Profile context active:</span>
                            <span className="text-teal-600">
                                {Object.keys(profileInsights).slice(0, 3).map(k => k.replace(/_/g, ' ')).join(', ')}
                                {Object.keys(profileInsights).length > 3 && ` +${Object.keys(profileInsights).length - 3} more`}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Chat Interface */}
                <div className="flex-1 overflow-hidden">
                    <ChatInterface
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        isLoading={isLoading}
                        placeholder="Ask anything about Twitter strategy, tweet ideas..."
                        showImageUpload={true}
                        accentColor="teal"
                        emptyStateMessage="Ask me about tweets, strategies, or anything Twitter-related!"
                    />
                </div>
            </div>
        </div>
    );
}
