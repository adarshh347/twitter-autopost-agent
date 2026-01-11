"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image as ImageIcon, X, Send, Smile, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import axios from 'axios';

export default function UploadPage() {
    const [text, setText] = useState('');
    const [image, setImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isPosting, setIsPosting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const maxChars = 280;
    const charsLeft = maxChars - text.length;
    const progress = (text.length / maxChars) * 100;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const removeImage = () => {
        setImage(null);
        setPreviewUrl(null);
    };

    const handlePost = async () => {
        if (!text.trim()) return;
        setIsPosting(true);
        setStatus('idle');

        try {
            // Note: Backend currently expects media_path (local), not a file upload.
            // We will send text only for now or handle simple text-based tweets.
            // If image exists, valid functionality would require backend update to support multipart/form-data.

            const payload = {
                text: text,
                media_path: null // Placeholder until backend specific upload support
            };

            await axios.post('http://localhost:8000/tweets', payload);

            setStatus('success');
            setText('');
            removeImage();
            setTimeout(() => setStatus('idle'), 3000);
        } catch (error) {
            console.error(error);
            setStatus('error');
        } finally {
            setIsPosting(false);
        }
    };

    return (
        <div className="min-h-screen pt-28 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col md:flex-row gap-8 items-start justify-center">

            {/* Editor Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full md:w-1/2 glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-teal-200/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

                <div className="mb-6">
                    <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-linear-to-r from-teal-500 to-cyan-600">
                        Compose Tweet
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Share your thoughts with the world.</p>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="What's happening?"
                            className="w-full h-48 p-4 bg-white/50 rounded-2xl border border-gray-100 focus:border-teal-400 focus:ring-4 focus:ring-teal-100/50 transition-all resize-none text-lg text-gray-800 placeholder-gray-400 outline-hidden"
                            maxLength={maxChars}
                        />

                        {/* Character Counter */}
                        <div className="absolute bottom-4 right-4 flex items-center gap-2">
                            <span className={`text-xs font-semibold ${charsLeft < 20 ? 'text-red-500' : 'text-gray-400'}`}>
                                {charsLeft}
                            </span>
                            <div className="w-6 h-6 rounded-full border-2 border-gray-100 relative items-center justify-center flex">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                                    <path
                                        className="text-gray-100"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className={charsLeft < 20 ? 'text-red-400' : 'text-teal-400'}
                                        strokeDasharray={`${progress}, 100`}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <div className="flex gap-2">
                            <label className="p-2.5 rounded-full hover:bg-teal-50 text-teal-600 cursor-pointer transition-colors active:scale-95">
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                <ImageIcon size={22} />
                            </label>
                            <button className="p-2.5 rounded-full hover:bg-teal-50 text-teal-600 transition-colors active:scale-95">
                                <Smile size={22} />
                            </button>
                            {/* AI Generate Button Mockup */}
                            <button className="p-2.5 rounded-full hover:bg-purple-50 text-purple-600 transition-colors active:scale-95 flex items-center gap-1">
                                <Sparkles size={18} />
                                <span className="text-xs font-medium">AI Draft</span>
                            </button>
                        </div>

                        <button
                            onClick={handlePost}
                            disabled={isPosting || !text.trim()}
                            className="bg-gray-900 text-white px-6 py-2.5 rounded-full font-medium shadow-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                        >
                            {isPosting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                            {isPosting ? 'Posting...' : 'Post'}
                        </button>
                    </div>
                </div>

                {/* Status Messages */}
                <AnimatePresence>
                    {status === 'success' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="mt-4 p-3 rounded-xl bg-green-50 text-green-700 flex items-center gap-2 text-sm border border-green-100"
                        >
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            Tweet successfully posted!
                        </motion.div>
                    )}
                    {status === 'error' && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="mt-4 p-3 rounded-xl bg-red-50 text-red-700 flex items-center gap-2 text-sm border border-red-100"
                        >
                            <AlertCircle size={16} />
                            Failed to post tweet. Check backend connection.
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Preview Section */}
            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="w-full md:w-1/3 space-y-4"
            >
                <h3 className="text-lg font-semibold text-gray-700 ml-2">Preview</h3>

                {/* Mock Twitter Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 max-w-sm mx-auto md:mx-0">
                    <div className="flex gap-3">
                        <div className="shrink-0">
                            <div className="w-10 h-10 rounded-full bg-linear-to-tr from-gray-200 to-gray-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-sm">
                                <span className="font-bold text-gray-900">You</span>
                                <span className="text-gray-500">@username</span>
                                <span className="text-gray-500">·</span>
                                <span className="text-gray-500">now</span>
                            </div>

                            <p className="text-gray-900 text-[15px] leading-snug whitespace-pre-wrap break-words mt-0.5">
                                {text || <span className="text-gray-400 italic">Tweet content will appear here...</span>}
                            </p>

                            {previewUrl && (
                                <div className="mt-3 relative rounded-2xl overflow-hidden border border-gray-100">
                                    <img src={previewUrl} alt="Upload preview" className="w-full h-auto max-h-64 object-cover" />
                                    <button
                                        onClick={removeImage}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-xs transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Tweet Actions Mockup */}
                            <div className="flex justify-between items-center mt-3 text-gray-500 max-w-xs">
                                <div className="w-4 h-4 bg-gray-200 rounded-xs" />
                                <div className="w-4 h-4 bg-gray-200 rounded-xs" />
                                <div className="w-4 h-4 bg-gray-200 rounded-xs" />
                                <div className="w-4 h-4 bg-gray-200 rounded-xs" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-5 rounded-2xl mt-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                        <Sparkles size={14} className="text-teal-500" /> AI Tip
                    </h4>
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Tweets with images get 150% more retweets. Try adding a visual to increase engagement!
                    </p>
                </div>

            </motion.div>
        </div>
    );
}
