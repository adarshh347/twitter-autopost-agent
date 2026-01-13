"use client";

import { useState, useEffect } from 'react';
import { RefreshCcw, Sparkles, Send, MessageCircle, Quote, FileText, Loader2, ChevronDown, ChevronUp, Zap, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

interface Tweet {
    tweet_id: string;
    user_name: string | null;
    user_handle: string | null;
    text_content: string;
    like_count: number;
    retweet_count: number;
    reply_count: number;
    view_count: number;
    tweet_url: string | null;
    profile_image_url: string | null;
    created_at: string | null;
}

interface Suggestion {
    quote_tweet?: string;
    reply?: string;
    independent_tweet?: string;
    context_summary?: string;
    error?: string;
}

interface TweetWithSuggestion extends Tweet {
    suggestion?: Suggestion;
    isLoadingSuggestion?: boolean;
    isExpanded?: boolean;
    userPrompt?: string;
}

export default function FeedAIPage() {
    const [tweets, setTweets] = useState<TweetWithSuggestion[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [isPosting, setIsPosting] = useState<string | null>(null);
    const [maxTweets, setMaxTweets] = useState(10);
    const [sessionActive, setSessionActive] = useState(false);
    const [globalPrompt, setGlobalPrompt] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        checkSession();
    }, []);

    const checkSession = async () => {
        try {
            const res = await axios.get('http://localhost:8000/session/status');
            setSessionActive(res.data.status === 'connected');
        } catch (err) {
            setSessionActive(false);
        }
    };

    const scanFeed = async () => {
        if (!sessionActive) {
            setError("Browser session not active. Please start a session first.");
            return;
        }

        setIsScanning(true);
        setError(null);
        setTweets([]);

        try {
            const res = await axios.get(`http://localhost:8000/feed/scan?max_tweets=${maxTweets}`);
            const fetchedTweets: TweetWithSuggestion[] = res.data.tweets.map((t: Tweet) => ({
                ...t,
                isExpanded: false,
                userPrompt: ''
            }));
            setTweets(fetchedTweets);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to scan feed');
        } finally {
            setIsScanning(false);
        }
    };

    const generateSuggestion = async (tweetId: string, customPrompt?: string) => {
        const tweet = tweets.find(t => t.tweet_id === tweetId);
        if (!tweet) return;

        setTweets(prev => prev.map(t =>
            t.tweet_id === tweetId ? { ...t, isLoadingSuggestion: true, isExpanded: true } : t
        ));

        try {
            const res = await axios.post('http://localhost:8000/feed/suggest', {
                tweet_id: tweetId,
                tweet_text: tweet.text_content,
                tweet_author: tweet.user_handle || 'Unknown',
                suggestion_type: 'all',
                user_prompt: customPrompt || globalPrompt || undefined
            });

            setTweets(prev => prev.map(t =>
                t.tweet_id === tweetId ? {
                    ...t,
                    suggestion: res.data.suggestions,
                    isLoadingSuggestion: false
                } : t
            ));
        } catch (err: any) {
            setTweets(prev => prev.map(t =>
                t.tweet_id === tweetId ? {
                    ...t,
                    suggestion: { error: err.response?.data?.detail || 'Failed to generate suggestion' },
                    isLoadingSuggestion: false
                } : t
            ));
        }
    };

    const postAction = async (tweetId: string, actionType: 'post' | 'quote' | 'reply', text: string) => {
        const tweet = tweets.find(t => t.tweet_id === tweetId);
        if (!tweet || !text) return;

        setIsPosting(`${tweetId}-${actionType}`);
        setError(null);

        try {
            await axios.post('http://localhost:8000/feed/post', {
                action_type: actionType,
                text: text,
                original_tweet_url: tweet.tweet_url
            });

            setSuccessMessage(`Successfully ${actionType === 'post' ? 'posted new tweet' : actionType === 'quote' ? 'quote tweeted' : 'replied'}!`);
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err: any) {
            setError(err.response?.data?.detail || `Failed to ${actionType}`);
        } finally {
            setIsPosting(null);
        }
    };

    const toggleExpand = (tweetId: string) => {
        setTweets(prev => prev.map(t =>
            t.tweet_id === tweetId ? { ...t, isExpanded: !t.isExpanded } : t
        ));
    };

    const updateUserPrompt = (tweetId: string, prompt: string) => {
        setTweets(prev => prev.map(t =>
            t.tweet_id === tweetId ? { ...t, userPrompt: prompt } : t
        ));
    };

    return (
        <div className="min-h-screen pt-24 pb-8 px-4 md:px-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="glass-panel rounded-3xl p-6 mb-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white shadow-lg">
                            <Zap size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Feed AI Suggestions</h1>
                            <p className="text-sm text-gray-500">
                                Scan your home timeline and get AI-powered engagement suggestions
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        {/* Session Status */}
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${sessionActive
                            ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
                            : 'bg-red-50 text-red-700 ring-1 ring-red-200'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${sessionActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                            {sessionActive ? 'Session Active' : 'Session Inactive'}
                        </div>

                        {/* Tweet Count Selector */}
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg">
                            <span className="text-xs text-gray-500">Tweets:</span>
                            <select
                                value={maxTweets}
                                onChange={(e) => setMaxTweets(Number(e.target.value))}
                                className="text-sm font-medium bg-transparent outline-none cursor-pointer"
                            >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={15}>15</option>
                                <option value={20}>20</option>
                            </select>
                        </div>

                        {/* Scan Button */}
                        <button
                            onClick={scanFeed}
                            disabled={isScanning || !sessionActive}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium hover:from-violet-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                        >
                            {isScanning ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Scanning...
                                </>
                            ) : (
                                <>
                                    <RefreshCcw size={18} />
                                    Scan Feed
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Global Prompt */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">
                        Global AI Instructions (Optional)
                    </label>
                    <input
                        type="text"
                        value={globalPrompt}
                        onChange={(e) => setGlobalPrompt(e.target.value)}
                        placeholder="e.g., Make responses more humorous, focus on tech insights, be concise..."
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition-all"
                    />
                </div>
            </div>

            {/* Alerts */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700"
                    >
                        <AlertCircle size={20} />
                        <span className="text-sm">{error}</span>
                        <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">×</button>
                    </motion.div>
                )}
                {successMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700"
                    >
                        <Sparkles size={20} />
                        <span className="text-sm font-medium">{successMessage}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Empty State */}
            {tweets.length === 0 && !isScanning && (
                <div className="glass-panel rounded-3xl p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center mx-auto mb-4">
                        <Zap size={40} className="text-violet-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Ready to Scan Your Feed</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                        Click "Scan Feed" to fetch tweets from your home timeline. Our AI will help you generate engaging responses for each tweet.
                    </p>
                </div>
            )}

            {/* Loading State */}
            {isScanning && (
                <div className="glass-panel rounded-3xl p-12 text-center">
                    <Loader2 size={48} className="animate-spin text-violet-500 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">Scanning Your Feed...</h3>
                    <p className="text-gray-500">This may take a moment as we gather tweets from your timeline.</p>
                </div>
            )}

            {/* Tweet Cards */}
            <div className="space-y-4">
                {tweets.map((tweet, index) => (
                    <motion.div
                        key={tweet.tweet_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="glass-panel rounded-2xl overflow-hidden"
                    >
                        {/* Tweet Header */}
                        <div className="p-5 border-b border-gray-100">
                            <div className="flex items-start gap-3">
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {tweet.profile_image_url ? (
                                        <img src={tweet.profile_image_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-gray-500 text-lg font-bold">
                                            {tweet.user_name?.charAt(0) || 'U'}
                                        </span>
                                    )}
                                </div>

                                {/* Tweet Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-gray-900 truncate">{tweet.user_name || 'Unknown'}</span>
                                        <span className="text-gray-400 text-sm truncate">{tweet.user_handle || ''}</span>
                                    </div>
                                    <p className="text-gray-700 whitespace-pre-wrap break-words">{tweet.text_content}</p>

                                    {/* Engagement Stats */}
                                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                                        <span>💬 {tweet.reply_count || 0}</span>
                                        <span>🔁 {tweet.retweet_count || 0}</span>
                                        <span>❤️ {tweet.like_count || 0}</span>
                                        <span>👁️ {tweet.view_count || 0}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button
                                        onClick={() => generateSuggestion(tweet.tweet_id, tweet.userPrompt)}
                                        disabled={tweet.isLoadingSuggestion}
                                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium rounded-xl hover:from-violet-600 hover:to-purple-700 transition-all disabled:opacity-50 shadow-md hover:shadow-lg"
                                    >
                                        {tweet.isLoadingSuggestion ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Sparkles size={16} />
                                        )}
                                        {tweet.suggestion ? 'Regenerate' : 'Get Suggestions'}
                                    </button>
                                    {tweet.suggestion && (
                                        <button
                                            onClick={() => toggleExpand(tweet.tweet_id)}
                                            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                                        >
                                            {tweet.isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Custom Prompt for this tweet */}
                            <div className="mt-3 pl-15">
                                <input
                                    type="text"
                                    value={tweet.userPrompt || ''}
                                    onChange={(e) => updateUserPrompt(tweet.tweet_id, e.target.value)}
                                    placeholder="Custom AI instructions for this tweet..."
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
                                />
                            </div>
                        </div>

                        {/* Suggestions Panel */}
                        <AnimatePresence>
                            {tweet.isExpanded && tweet.suggestion && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="bg-gradient-to-br from-violet-50 to-purple-50"
                                >
                                    <div className="p-5 space-y-4">
                                        {tweet.suggestion.error ? (
                                            <div className="text-red-600 text-sm p-3 bg-red-50 rounded-lg">
                                                {tweet.suggestion.error}
                                            </div>
                                        ) : (
                                            <>
                                                {/* Context Summary */}
                                                {tweet.suggestion.context_summary && (
                                                    <div className="text-sm text-gray-600 p-3 bg-white/60 rounded-lg">
                                                        <span className="font-medium text-violet-600">Context:</span> {tweet.suggestion.context_summary}
                                                    </div>
                                                )}

                                                {/* Suggestion Cards */}
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    {/* Quote Tweet */}
                                                    {tweet.suggestion.quote_tweet && (
                                                        <SuggestionCard
                                                            icon={<Quote size={16} />}
                                                            title="Quote Tweet"
                                                            content={tweet.suggestion.quote_tweet}
                                                            onPost={() => postAction(tweet.tweet_id, 'quote', tweet.suggestion?.quote_tweet || '')}
                                                            isLoading={isPosting === `${tweet.tweet_id}-quote`}
                                                            color="blue"
                                                        />
                                                    )}

                                                    {/* Reply */}
                                                    {tweet.suggestion.reply && (
                                                        <SuggestionCard
                                                            icon={<MessageCircle size={16} />}
                                                            title="Reply"
                                                            content={tweet.suggestion.reply}
                                                            onPost={() => postAction(tweet.tweet_id, 'reply', tweet.suggestion?.reply || '')}
                                                            isLoading={isPosting === `${tweet.tweet_id}-reply`}
                                                            color="green"
                                                        />
                                                    )}

                                                    {/* Independent Tweet */}
                                                    {tweet.suggestion.independent_tweet && (
                                                        <SuggestionCard
                                                            icon={<FileText size={16} />}
                                                            title="New Tweet"
                                                            content={tweet.suggestion.independent_tweet}
                                                            onPost={() => postAction(tweet.tweet_id, 'post', tweet.suggestion?.independent_tweet || '')}
                                                            isLoading={isPosting === `${tweet.tweet_id}-post`}
                                                            color="violet"
                                                        />
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// Suggestion Card Component
function SuggestionCard({
    icon,
    title,
    content,
    onPost,
    isLoading,
    color
}: {
    icon: React.ReactNode;
    title: string;
    content: string;
    onPost: () => void;
    isLoading: boolean;
    color: 'blue' | 'green' | 'violet';
}) {
    const colorClasses = {
        blue: 'from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
        green: 'from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
        violet: 'from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600'
    };

    const bgClasses = {
        blue: 'bg-blue-50 border-blue-100',
        green: 'bg-green-50 border-green-100',
        violet: 'bg-violet-50 border-violet-100'
    };

    const iconBgClasses = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        violet: 'bg-violet-100 text-violet-600'
    };

    return (
        <div className={`p-4 rounded-xl border ${bgClasses[color]}`}>
            <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBgClasses[color]}`}>
                    {icon}
                </div>
                <span className="font-semibold text-gray-800 text-sm">{title}</span>
            </div>
            <p className="text-sm text-gray-700 mb-3 whitespace-pre-wrap">{content}</p>
            <button
                onClick={onPost}
                disabled={isLoading}
                className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-gradient-to-r ${colorClasses[color]} text-white text-sm font-medium transition-all disabled:opacity-50 shadow-md hover:shadow-lg`}
            >
                {isLoading ? (
                    <>
                        <Loader2 size={14} className="animate-spin" />
                        Posting...
                    </>
                ) : (
                    <>
                        <Send size={14} />
                        Post This
                    </>
                )}
            </button>
        </div>
    );
}
