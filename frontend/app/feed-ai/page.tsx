"use client";

import { useState, useEffect } from 'react';
import { RefreshCcw, Sparkles, Send, MessageCircle, Quote, FileText, Loader2, ChevronDown, ChevronUp, Zap, AlertCircle, Edit2, ExternalLink, PenLine, Wand2, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { useSidebar } from '@/context/SidebarContext';

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
    embedded_media_urls?: string[];
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
    // Manual draft fields per tweet
    manualDraft?: string;
    manualDraftType?: 'quote' | 'reply' | 'post';
    manualRefinements?: Refinement[];
    isRefiningManual?: boolean;
    selectedManualRefinement?: string | null;
    showManualMode?: boolean;
}

interface Refinement {
    version: number;
    text: string;
    style: string;
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
    const { openSidebar } = useSidebar();
    const [manualUrl, setManualUrl] = useState('');
    const [isFetchingUrl, setIsFetchingUrl] = useState(false);

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

    const fetchTweetFromUrl = async () => {
        if (!sessionActive) {
            setError("Browser session not active. Please start a session first.");
            return;
        }

        if (!manualUrl.trim()) {
            setError("Please enter a tweet URL");
            return;
        }

        // Basic URL validation
        if (!manualUrl.includes('twitter.com/') && !manualUrl.includes('x.com/')) {
            setError("Please enter a valid Twitter/X URL");
            return;
        }

        setIsFetchingUrl(true);
        setError(null);

        try {
            const res = await axios.post('http://localhost:8000/feed/fetch-url', {
                tweet_url: manualUrl.trim()
            });

            const fetchedTweet: TweetWithSuggestion = {
                ...res.data.tweet,
                isExpanded: false,
                userPrompt: ''
            };

            // Add to beginning of tweets list (avoid duplicates)
            setTweets(prev => {
                const exists = prev.find(t => t.tweet_id === fetchedTweet.tweet_id);
                if (exists) {
                    setSuccessMessage("Tweet already in list!");
                    setTimeout(() => setSuccessMessage(null), 2000);
                    return prev;
                }
                setSuccessMessage("Tweet added successfully!");
                setTimeout(() => setSuccessMessage(null), 2000);
                return [fetchedTweet, ...prev];
            });

            setManualUrl(''); // Clear input after success
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to fetch tweet from URL');
        } finally {
            setIsFetchingUrl(false);
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

    const handleEditWithAI = (content: string, type: string) => {
        const prompt = `I need help refining this ${type}. Here is the draft:\n\n"${content}"\n\nPlease suggest improvements to make it more engaging and professional.`;
        openSidebar(prompt);
    };

    // Per-tweet manual draft handlers
    const toggleManualMode = (tweetId: string) => {
        setTweets(prev => prev.map(t =>
            t.tweet_id === tweetId ? {
                ...t,
                showManualMode: !t.showManualMode,
                manualDraftType: t.manualDraftType || 'quote'
            } : t
        ));
    };

    const updateManualDraft = (tweetId: string, draft: string) => {
        setTweets(prev => prev.map(t =>
            t.tweet_id === tweetId ? { ...t, manualDraft: draft } : t
        ));
    };

    const updateManualDraftType = (tweetId: string, type: 'quote' | 'reply' | 'post') => {
        setTweets(prev => prev.map(t =>
            t.tweet_id === tweetId ? { ...t, manualDraftType: type } : t
        ));
    };

    const selectManualRefinement = (tweetId: string, text: string | null) => {
        setTweets(prev => prev.map(t =>
            t.tweet_id === tweetId ? { ...t, selectedManualRefinement: text } : t
        ));
    };

    const refineManualDraft = async (tweetId: string) => {
        const tweet = tweets.find(t => t.tweet_id === tweetId);
        if (!tweet?.manualDraft?.trim()) {
            setError('Please write something to refine');
            return;
        }

        setTweets(prev => prev.map(t =>
            t.tweet_id === tweetId ? { ...t, isRefiningManual: true, manualRefinements: [], selectedManualRefinement: null } : t
        ));

        try {
            const res = await axios.post('http://localhost:8000/feed/refine', {
                draft_text: tweet.manualDraft,
                post_type: tweet.manualDraftType || 'quote',
                original_tweet_url: tweet.tweet_url || undefined,
                original_tweet_text: tweet.text_content,
            });

            setTweets(prev => prev.map(t =>
                t.tweet_id === tweetId ? { ...t, manualRefinements: res.data.refinements || [], isRefiningManual: false } : t
            ));
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to refine draft');
            setTweets(prev => prev.map(t =>
                t.tweet_id === tweetId ? { ...t, isRefiningManual: false } : t
            ));
        }
    };

    const postManualContent = async (tweetId: string, text: string) => {
        const tweet = tweets.find(t => t.tweet_id === tweetId);
        if (!tweet || !text.trim()) return;

        const actionType = tweet.manualDraftType || 'quote';
        setIsPosting(`${tweetId}-manual`);
        setError(null);

        try {
            await axios.post('http://localhost:8000/feed/post', {
                action_type: actionType,
                text: text,
                original_tweet_url: actionType !== 'post' ? tweet.tweet_url : undefined
            });

            setSuccessMessage(`Successfully ${actionType === 'post' ? 'posted tweet' : actionType === 'quote' ? 'quote tweeted' : 'replied'}!`);
            setTimeout(() => setSuccessMessage(null), 3000);

            // Reset manual draft for this tweet
            setTweets(prev => prev.map(t =>
                t.tweet_id === tweetId ? {
                    ...t,
                    manualDraft: '',
                    manualRefinements: [],
                    selectedManualRefinement: null,
                    showManualMode: false
                } : t
            ));
        } catch (err: any) {
            setError(err.response?.data?.detail || `Failed to ${actionType}`);
        } finally {
            setIsPosting(null);
        }
    };

    const handleManualEditWithAI = (tweetId: string) => {
        const tweet = tweets.find(t => t.tweet_id === tweetId);
        if (!tweet) return;

        const textToEdit = tweet.selectedManualRefinement || tweet.manualDraft || '';
        if (!textToEdit.trim()) {
            setError('Write or select text to edit with AI');
            return;
        }
        handleEditWithAI(textToEdit, tweet.manualDraftType || 'quote');
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

            {/* Manual URL Input Section */}
            <div className="glass-panel rounded-2xl p-5 mb-6">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-teal-500 flex items-center justify-center text-white shadow-md">
                        <Link size={20} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">Analyze Specific Tweet</h3>
                        <p className="text-xs text-gray-500">Paste a tweet URL to get AI suggestions</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={manualUrl}
                        onChange={(e) => setManualUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isFetchingUrl && sessionActive) {
                                fetchTweetFromUrl();
                            }
                        }}
                        placeholder="https://x.com/username/status/123... or https://twitter.com/..."
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-cyan-400 transition-all"
                    />
                    <button
                        onClick={fetchTweetFromUrl}
                        disabled={isFetchingUrl || !sessionActive || !manualUrl.trim()}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 text-white font-medium hover:from-cyan-600 hover:to-teal-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                    >
                        {isFetchingUrl ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Fetching...
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                Fetch & Analyze
                            </>
                        )}
                    </button>
                </div>

                {!sessionActive && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <AlertCircle size={12} />
                        Start a browser session to use this feature
                    </p>
                )}
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
                                        {tweet.tweet_url && (
                                            <a
                                                href={tweet.tweet_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-auto text-gray-400 hover:text-violet-500 transition-colors"
                                                title="View on Twitter"
                                            >
                                                <ExternalLink size={16} />
                                            </a>
                                        )}
                                    </div>
                                    <p className="text-gray-700 whitespace-pre-wrap break-words">{tweet.text_content}</p>

                                    {/* Embedded Media/Images */}
                                    {tweet.embedded_media_urls && tweet.embedded_media_urls.length > 0 && (
                                        <div className={`mt-3 grid gap-2 ${tweet.embedded_media_urls.length === 1 ? 'grid-cols-1' : tweet.embedded_media_urls.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                                            {tweet.embedded_media_urls.slice(0, 4).map((url, idx) => (
                                                <div key={idx} className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video">
                                                    <img
                                                        src={url}
                                                        alt={`Tweet media ${idx + 1}`}
                                                        className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                                                        onClick={() => window.open(url, '_blank')}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}

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
                                                            onEdit={() => handleEditWithAI(tweet.suggestion?.quote_tweet || '', 'quote tweet')}
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
                                                            onEdit={() => handleEditWithAI(tweet.suggestion?.reply || '', 'reply')}
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
                                                            onEdit={() => handleEditWithAI(tweet.suggestion?.independent_tweet || '', 'tweet')}
                                                            isLoading={isPosting === `${tweet.tweet_id}-post`}
                                                            color="violet"
                                                        />
                                                    )}
                                                </div>

                                                {/* Write Your Own Section */}
                                                <div className="mt-4 pt-4 border-t border-violet-100">
                                                    <button
                                                        onClick={() => toggleManualMode(tweet.tweet_id)}
                                                        className="flex items-center gap-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                                                    >
                                                        <PenLine size={16} />
                                                        {tweet.showManualMode ? 'Hide Manual Mode' : 'Write Your Own Response'}
                                                    </button>

                                                    <AnimatePresence>
                                                        {tweet.showManualMode && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="mt-4 space-y-3 p-4 bg-white rounded-xl border border-emerald-100">
                                                                    {/* Type Selector */}
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs font-medium text-gray-500">Type:</span>
                                                                        <div className="flex gap-1.5">
                                                                            {(['quote', 'reply', 'post'] as const).map(type => (
                                                                                <button
                                                                                    key={type}
                                                                                    onClick={() => updateManualDraftType(tweet.tweet_id, type)}
                                                                                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${tweet.manualDraftType === type
                                                                                        ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                                                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                                        }`}
                                                                                >
                                                                                    {type === 'post' ? 'New Tweet' : type === 'quote' ? 'Quote' : 'Reply'}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    {/* Text Area */}
                                                                    <textarea
                                                                        value={tweet.manualDraft || ''}
                                                                        onChange={(e) => updateManualDraft(tweet.tweet_id, e.target.value)}
                                                                        placeholder="Write your response here..."
                                                                        rows={2}
                                                                        maxLength={500}
                                                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
                                                                    />

                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs text-gray-400">{(tweet.manualDraft?.length || 0)}/280</span>
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={() => handleManualEditWithAI(tweet.tweet_id)}
                                                                                disabled={!tweet.manualDraft?.trim() && !tweet.selectedManualRefinement}
                                                                                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-all disabled:opacity-50"
                                                                            >
                                                                                <Edit2 size={14} />
                                                                                Edit with AI
                                                                            </button>
                                                                            <button
                                                                                onClick={() => refineManualDraft(tweet.tweet_id)}
                                                                                disabled={tweet.isRefiningManual || !tweet.manualDraft?.trim()}
                                                                                className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-medium rounded-lg hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 shadow-sm"
                                                                            >
                                                                                {tweet.isRefiningManual ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                                                                                Get Refinements
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {/* Manual Refinements */}
                                                                    {tweet.manualRefinements && tweet.manualRefinements.length > 0 && (
                                                                        <div className="space-y-2 pt-3 border-t border-gray-100">
                                                                            <h5 className="text-xs font-semibold text-gray-500 uppercase">Select Version</h5>

                                                                            {/* Original */}
                                                                            <div
                                                                                onClick={() => selectManualRefinement(tweet.tweet_id, tweet.manualDraft || '')}
                                                                                className={`p-2 rounded-lg border cursor-pointer transition-all text-xs ${tweet.selectedManualRefinement === tweet.manualDraft
                                                                                    ? 'border-emerald-400 bg-emerald-50'
                                                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                                                                    }`}
                                                                            >
                                                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Original</span>
                                                                                <p className="text-gray-700 mt-1">{tweet.manualDraft}</p>
                                                                            </div>

                                                                            {tweet.manualRefinements.map((ref) => (
                                                                                <div
                                                                                    key={ref.version}
                                                                                    onClick={() => selectManualRefinement(tweet.tweet_id, ref.text)}
                                                                                    className={`p-2 rounded-lg border cursor-pointer transition-all text-xs ${tweet.selectedManualRefinement === ref.text
                                                                                        ? 'border-emerald-400 bg-emerald-50'
                                                                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                                                                        }`}
                                                                                >
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-[10px] font-bold text-emerald-600 uppercase">v{ref.version}</span>
                                                                                        <span className="text-[10px] text-gray-400">{ref.style}</span>
                                                                                    </div>
                                                                                    <p className="text-gray-700 mt-1">{ref.text}</p>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {/* Post Button */}
                                                                    {(tweet.manualDraft?.trim() || tweet.selectedManualRefinement) && (
                                                                        <button
                                                                            onClick={() => postManualContent(tweet.tweet_id, tweet.selectedManualRefinement || tweet.manualDraft || '')}
                                                                            disabled={isPosting === `${tweet.tweet_id}-manual`}
                                                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium rounded-lg hover:from-violet-600 hover:to-purple-700 transition-all disabled:opacity-50 shadow-md"
                                                                        >
                                                                            {isPosting === `${tweet.tweet_id}-manual` ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                                                            Post {tweet.manualDraftType === 'post' ? 'Tweet' : tweet.manualDraftType === 'quote' ? 'Quote' : 'Reply'}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
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
    onEdit,
    isLoading,
    color
}: {
    icon: React.ReactNode;
    title: string;
    content: string;
    onPost: () => void;
    onEdit: () => void;
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
            <div className="flex items-center gap-2">
                <button
                    onClick={onEdit}
                    disabled={isLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm"
                >
                    <Edit2 size={14} />
                    Edit
                </button>
                <button
                    onClick={onPost}
                    disabled={isLoading}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-gradient-to-r ${colorClasses[color]} text-white text-sm font-medium transition-all disabled:opacity-50 shadow-md hover:shadow-lg`}
                >
                    {isLoading ? (
                        <>
                            <Loader2 size={14} className="animate-spin" />
                            Post
                        </>
                    ) : (
                        <>
                            <Send size={14} />
                            Post
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
