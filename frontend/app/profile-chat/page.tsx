"use client";

import { useState, useEffect } from 'react';
import { Bot, Trash2, Download, Lightbulb, Settings, ChevronDown } from 'lucide-react';
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

export default function ProfileChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [insights, setInsights] = useState<Record<string, any>>({});
    const [models, setModels] = useState<{ text: Model[]; vision: Model[] }>({ text: [], vision: [] });
    const [selectedModel, setSelectedModel] = useState<string>('qwen-qwq-32b');
    const [showModelSelect, setShowModelSelect] = useState(false);
    const [extracting, setExtracting] = useState(false);

    useEffect(() => {
        loadHistory();
        loadModels();
    }, []);

    const loadHistory = async () => {
        try {
            const res = await axios.get('http://localhost:8000/chat/profile/history');
            setMessages(res.data.messages || []);
            setInsights(res.data.insights || {});
        } catch (err) {
            console.error("Failed to load history", err);
        }
    };

    const loadModels = async () => {
        try {
            const res = await axios.get('http://localhost:8000/chat/models');
            setModels(res.data.models);
        } catch (err) {
            console.error("Failed to load models", err);
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
            const res = await axios.post('http://localhost:8000/chat/profile', {
                message,
                image_data: imageData,
                model: selectedModel
            });

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

    const handleClearChat = async () => {
        if (!confirm("Clear all profile chat history?")) return;

        try {
            await axios.post('http://localhost:8000/chat/profile/clear');
            setMessages([]);
        } catch (err) {
            console.error("Failed to clear", err);
        }
    };

    const handleExtractInsights = async () => {
        if (messages.length === 0) {
            alert("No conversation to extract insights from");
            return;
        }

        setExtracting(true);
        try {
            const res = await axios.post('http://localhost:8000/chat/profile/extract-insights');
            setInsights(res.data.insights || {});
            alert(`Extracted ${res.data.insights_extracted} insights!`);
        } catch (err: any) {
            console.error("Extraction error", err);
            alert(err.response?.data?.detail || "Failed to extract insights");
        } finally {
            setExtracting(false);
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-8 px-4 md:px-6 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)]">

                {/* Main Chat Area */}
                <div className="lg:col-span-3 glass-panel rounded-3xl overflow-hidden flex flex-col">
                    {/* Chat Header */}
                    <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white shadow-lg">
                                <Bot size={20} />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-gray-900">Profile Analyzer</h1>
                                <p className="text-xs text-gray-500">Define your Twitter goals and strategy</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
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
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedModel === model.id ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50'
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

                            <button
                                onClick={handleClearChat}
                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Clear chat"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Chat Interface */}
                    <div className="flex-1 overflow-hidden">
                        <ChatInterface
                            messages={messages}
                            onSendMessage={handleSendMessage}
                            isLoading={isLoading}
                            placeholder="Tell me about your Twitter profile, goals, niche..."
                            showImageUpload={true}
                            accentColor="purple"
                            emptyStateMessage="Start by describing your Twitter profile and goals..."
                        />
                    </div>
                </div>

                {/* Insights Sidebar */}
                <div className="glass-panel rounded-3xl p-5 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Lightbulb size={18} className="text-yellow-500" />
                            Profile Insights
                        </h3>
                        <button
                            onClick={handleExtractInsights}
                            disabled={extracting || messages.length === 0}
                            className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-medium hover:bg-purple-200 disabled:opacity-50 transition-colors"
                        >
                            {extracting ? "Extracting..." : "Extract"}
                        </button>
                    </div>

                    {Object.keys(insights).length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-center">
                            <div className="text-gray-400 text-sm">
                                <Lightbulb size={32} className="mx-auto mb-2 opacity-30" />
                                <p>Chat about your profile to build insights.</p>
                                <p className="text-xs mt-1">Click "Extract" after discussing your goals.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 flex-1 overflow-y-auto">
                            {Object.entries(insights).map(([key, data]: [string, any]) => (
                                <div key={key} className="p-3 bg-white rounded-xl border border-gray-100">
                                    <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">
                                        {key.replace(/_/g, ' ')}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                        {typeof data === 'object' ? data.value : data}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400 text-center">
                            These insights are saved and can be used as context in the General Chat.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
