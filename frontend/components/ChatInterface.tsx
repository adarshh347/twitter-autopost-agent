"use client";

import { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, X, Loader2, Bot, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface Message {
    id: string | number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at?: string;
    model_used?: string;
    has_image?: boolean;
}

interface ChatInterfaceProps {
    messages: Message[];
    onSendMessage: (message: string, imageData?: string) => Promise<void>;
    isLoading: boolean;
    placeholder?: string;
    title?: string;
    subtitle?: string;
    showImageUpload?: boolean;
    accentColor?: string;
    emptyStateMessage?: string;
}

export default function ChatInterface({
    messages,
    onSendMessage,
    isLoading,
    placeholder = "Type your message...",
    title,
    subtitle,
    showImageUpload = true,
    accentColor = "teal",
    emptyStateMessage = "Start a conversation..."
}: ChatInterfaceProps) {
    const [input, setInput] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageData, setImageData] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                setImageData(base64);
                setImagePreview(reader.result as string);
            };

            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setImagePreview(null);
        setImageData(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() && !imageData) return;

        const message = input;
        const image = imageData;

        setInput('');
        removeImage();

        await onSendMessage(message, image || undefined);
    };

    const formatContent = (content: string) => {
        // Simple markdown-like formatting
        return content
            .split('\n')
            .map((line, i) => {
                // Bold text
                line = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                // Bullet points
                if (line.startsWith('- ')) {
                    return `<li key="${i}" class="ml-4">${line.substring(2)}</li>`;
                }
                return line;
            })
            .join('<br/>');
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            {(title || subtitle) && (
                <div className="px-6 py-4 border-b border-gray-100 bg-white/50 backdrop-blur-sm">
                    {title && <h2 className="text-lg font-semibold text-gray-900">{title}</h2>}
                    {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Bot size={48} className="mb-4 opacity-30" />
                        <p>{emptyStateMessage}</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {messages.map((msg, idx) => (
                            <motion.div
                                key={msg.id || idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={clsx(
                                    "flex gap-3",
                                    msg.role === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                {msg.role === 'assistant' && (
                                    <div className={`w-8 h-8 rounded-full bg-${accentColor}-100 flex items-center justify-center flex-shrink-0`}>
                                        <Sparkles size={16} className={`text-${accentColor}-600`} />
                                    </div>
                                )}

                                <div
                                    className={clsx(
                                        "max-w-[80%] rounded-2xl px-4 py-3",
                                        msg.role === 'user'
                                            ? "bg-gray-900 text-white"
                                            : "bg-white border border-gray-100 shadow-sm text-gray-800"
                                    )}
                                >
                                    <div
                                        className="text-sm leading-relaxed whitespace-pre-wrap"
                                        dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                                    />
                                    {msg.model_used && msg.role === 'assistant' && (
                                        <div className="mt-2 text-[10px] text-gray-400">
                                            {msg.model_used}
                                        </div>
                                    )}
                                </div>

                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
                                        <User size={16} className="text-white" />
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}

                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3"
                    >
                        <div className={`w-8 h-8 rounded-full bg-${accentColor}-100 flex items-center justify-center`}>
                            <Loader2 size={16} className={`text-${accentColor}-600 animate-spin`} />
                        </div>
                        <div className="bg-white border border-gray-100 shadow-sm rounded-2xl px-4 py-3">
                            <div className="flex gap-1">
                                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </motion.div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Image Preview */}
            <AnimatePresence>
                {imagePreview && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="px-6 py-3 border-t border-gray-100 bg-gray-50"
                    >
                        <div className="relative inline-block">
                            <img
                                src={imagePreview}
                                alt="Upload preview"
                                className="h-20 rounded-lg object-cover"
                            />
                            <button
                                onClick={removeImage}
                                className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-100 bg-white/80 backdrop-blur-sm">
                <div className="flex items-end gap-2">
                    {showImageUpload && (
                        <>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={`p-2.5 rounded-full hover:bg-${accentColor}-50 text-${accentColor}-600 transition-colors flex-shrink-0`}
                            >
                                <ImageIcon size={20} />
                            </button>
                        </>
                    )}

                    <textarea
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            // Auto-resize
                            e.target.style.height = 'auto';
                            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                        }}
                        onKeyDown={(e) => {
                            // Submit on Enter (without Shift)
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                        placeholder={placeholder}
                        disabled={isLoading}
                        rows={1}
                        className="flex-1 px-4 py-2.5 bg-gray-50 rounded-2xl border border-gray-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 outline-none text-sm transition-all disabled:opacity-50 resize-none min-h-[42px] max-h-[200px] overflow-y-auto"
                        style={{ height: '42px' }}
                    />

                    <button
                        type="submit"
                        disabled={isLoading || (!input.trim() && !imageData)}
                        className={clsx(
                            "p-2.5 rounded-full transition-all flex-shrink-0",
                            input.trim() || imageData
                                ? `bg-${accentColor}-500 text-white hover:bg-${accentColor}-600 shadow-lg`
                                : "bg-gray-100 text-gray-400"
                        )}
                    >
                        {isLoading ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Send size={20} />
                        )}
                    </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-center">Press Enter to send, Shift+Enter for new line</p>
            </form>

        </div>
    );
}
