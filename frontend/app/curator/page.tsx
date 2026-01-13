"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, Image as ImageIcon, Sparkles, Wand2, Send,
    ChevronRight, CheckCircle, XCircle, AlertCircle,
    Palette, BookOpen, Eye, RefreshCw, Copy, Loader2,
    Grid, Trash2, Download, ExternalLink, CloudUpload
} from 'lucide-react';
import { curator, gallery } from '@/lib/api';
import { clsx } from 'clsx';

interface TweetFamily {
    family_id: string;
    name: string;
    display_name: string;
    core_themes: string[];
    tone_profile: string[];
}

interface TweetArchetype {
    archetype_id: string;
    name: string;
    template_structure: string;
    example_tweets: string[];
    tone_requirements: string[];
}

interface ImageAnalysis {
    image_id: string;
    mood_description: string;
    aesthetic_style: string[];
    symbolic_elements: string[];
    philosophical_resonance: string[];
    tweet_family_fit: string[];
    suggested_archetypes: string[];
    strengths: string[];
    weaknesses: string[];
    aura_score: number;
}

interface ImageMetadata {
    image_id: string;
    brightness: number;
    contrast: number;
    saturation: number;
    dominant_colors: string[];
    composition: string;
}

interface TasteScore {
    is_approved: boolean;
    final_score: number;
    rejection_reasons: string[];
    bonus_reasons: string[];
}

interface GalleryImage {
    public_id: string;
    url: string;
    thumbnail_url: string;
    width: number;
    height: number;
    format: string;
    bytes: number;
    created_at: string;
}

export default function CuratorPage() {
    const [families, setFamilies] = useState<TweetFamily[]>([]);
    const [archetypes, setArchetypes] = useState<TweetArchetype[]>([]);
    const [selectedFamily, setSelectedFamily] = useState<TweetFamily | null>(null);
    const [selectedArchetype, setSelectedArchetype] = useState<TweetArchetype | null>(null);

    // Upload mode states
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Gallery states
    const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
    const [selectedGalleryImage, setSelectedGalleryImage] = useState<GalleryImage | null>(null);
    const [isLoadingGallery, setIsLoadingGallery] = useState(false);
    const [isUploadingToGallery, setIsUploadingToGallery] = useState(false);
    const [isPosting, setIsPosting] = useState(false);

    const [analysisResult, setAnalysisResult] = useState<{
        metadata: ImageMetadata;
        analysis: ImageAnalysis | null;
        taste_score: TasteScore;
        approved: boolean;
        taste_summary: string;
    } | null>(null);

    const [generatedTweet, setGeneratedTweet] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState('');
    const [activeTab, setActiveTab] = useState<'gallery' | 'upload' | 'families' | 'archetypes'>('gallery');
    const [copied, setCopied] = useState(false);

    // Load families and archetypes on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const [famRes, archRes] = await Promise.all([
                    curator.getFamilies(),
                    curator.getArchetypes()
                ]);
                setFamilies(famRes.data.families || []);
                setArchetypes(archRes.data.archetypes || []);
            } catch (err) {
                console.error('Failed to load curator data:', err);
            }
        };
        loadData();
    }, []);

    // Load gallery on mount
    useEffect(() => {
        loadGallery();
    }, []);

    const loadGallery = async () => {
        setIsLoadingGallery(true);
        try {
            const response = await gallery.getImages(50);
            setGalleryImages(response.data.images || []);
        } catch (err) {
            console.error('Failed to load gallery:', err);
        } finally {
            setIsLoadingGallery(false);
        }
    };

    const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setUploadedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage(reader.result as string);
            };
            reader.readAsDataURL(file);
            setAnalysisResult(null);
            setGeneratedTweet(null);
            setSelectedGalleryImage(null);
        }
    }, []);

    const handleUploadToGallery = async () => {
        if (!uploadedFile) return;

        setIsUploadingToGallery(true);
        try {
            const response = await gallery.upload(uploadedFile);
            if (response.data.success) {
                // Refresh gallery
                await loadGallery();
                // Clear upload
                setUploadedFile(null);
                setUploadedImage(null);
                // Switch to gallery tab
                setActiveTab('gallery');
            }
        } catch (err) {
            console.error('Gallery upload failed:', err);
            alert('Failed to upload to gallery');
        } finally {
            setIsUploadingToGallery(false);
        }
    };

    const handleSelectGalleryImage = (image: GalleryImage) => {
        setSelectedGalleryImage(image);
        setUploadedImage(image.url);
        setAnalysisResult(null);
        setGeneratedTweet(null);
    };

    const handleAnalyze = async () => {
        if (!uploadedFile && !selectedGalleryImage) return;

        setIsAnalyzing(true);
        try {
            let response;
            if (uploadedFile) {
                response = await curator.analyzeUpload(uploadedFile, false);
            } else if (selectedGalleryImage) {
                // For gallery images, download and re-upload
                const imageResponse = await fetch(selectedGalleryImage.url);
                const blob = await imageResponse.blob();
                const file = new File([blob], 'gallery-image.jpg', { type: blob.type });
                response = await curator.analyzeUpload(file, false);
            }

            if (response) {
                setAnalysisResult(response.data);

                // Auto-select recommended family if available
                if (response.data.analysis?.tweet_family_fit?.length > 0) {
                    const matchingFamily = families.find(f =>
                        response.data.analysis.tweet_family_fit.some((fit: string) =>
                            f.name.toLowerCase().includes(fit.toLowerCase()) ||
                            fit.toLowerCase().includes(f.display_name.toLowerCase())
                        )
                    );
                    if (matchingFamily) setSelectedFamily(matchingFamily);
                }

                // Auto-select recommended archetype
                if (response.data.analysis?.suggested_archetypes?.length > 0) {
                    const matchingArchetype = archetypes.find(a =>
                        response.data.analysis.suggested_archetypes.some((sug: string) =>
                            a.archetype_id.includes(sug) || sug.includes(a.archetype_id)
                        )
                    );
                    if (matchingArchetype) setSelectedArchetype(matchingArchetype);
                }
            }
        } catch (err) {
            console.error('Analysis failed:', err);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleGenerate = async () => {
        if (!analysisResult?.metadata?.image_id) return;

        setIsGenerating(true);
        try {
            const response = await curator.generateTweet(
                analysisResult.metadata.image_id,
                selectedFamily?.family_id,
                selectedArchetype?.archetype_id,
                customPrompt || undefined
            );

            if (response.data.tweet?.text) {
                setGeneratedTweet(response.data.tweet.text);
            } else if (response.data.error) {
                alert(response.data.error);
            }
        } catch (err) {
            console.error('Generation failed:', err);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePostTweet = async () => {
        if (!generatedTweet || !selectedFamily || !selectedArchetype) {
            alert('Please generate a tweet and select a family and archetype first');
            return;
        }

        setIsPosting(true);
        try {
            if (selectedGalleryImage) {
                // Post from gallery and delete after
                const response = await curator.postFromGallery(
                    selectedGalleryImage.public_id,
                    generatedTweet,
                    selectedFamily.family_id,
                    selectedArchetype.archetype_id,
                    true // delete after post
                );

                if (response.data.status === 'success') {
                    alert('Tweet posted successfully! Image removed from gallery.');
                    // Refresh gallery
                    await loadGallery();
                    // Reset state
                    resetState();
                }
            } else {
                alert('Please select an image from the gallery to post');
            }
        } catch (err) {
            console.error('Post failed:', err);
            alert('Failed to post tweet');
        } finally {
            setIsPosting(false);
        }
    };

    const handleDeleteGalleryImage = async (publicId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this image?')) return;

        try {
            await gallery.delete(publicId);
            await loadGallery();
            if (selectedGalleryImage?.public_id === publicId) {
                setSelectedGalleryImage(null);
                setUploadedImage(null);
            }
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Failed to delete image');
        }
    };

    const resetState = () => {
        setSelectedGalleryImage(null);
        setUploadedImage(null);
        setUploadedFile(null);
        setAnalysisResult(null);
        setGeneratedTweet(null);
        setSelectedFamily(null);
        setSelectedArchetype(null);
        setCustomPrompt('');
    };

    const copyToClipboard = () => {
        if (generatedTweet) {
            navigator.clipboard.writeText(generatedTweet);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 70) return 'text-emerald-600';
        if (score >= 50) return 'text-amber-600';
        return 'text-red-500';
    };

    const getScoreBg = (score: number) => {
        if (score >= 70) return 'bg-emerald-100';
        if (score >= 50) return 'bg-amber-100';
        return 'bg-red-100';
    };

    return (
        <div className="min-h-screen pt-24 pb-12 px-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 border border-purple-200/50 mb-6">
                        <Palette className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-700">Aesthetic Tweet Curator</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                        Curate with <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">Taste</span>
                    </h1>
                    <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                        Select from your Cloudinary gallery, analyze aesthetics, and generate philosophically resonant tweets.
                    </p>
                </div>

                {/* Tab Navigation */}
                <div className="flex justify-center mb-8">
                    <div className="inline-flex p-1 rounded-2xl bg-white/70 backdrop-blur-sm border border-gray-200/50 shadow-sm">
                        {[
                            { id: 'gallery', label: 'Image Gallery', icon: Grid },
                            { id: 'upload', label: 'Upload New', icon: CloudUpload },
                            { id: 'families', label: 'Tweet Families', icon: BookOpen },
                            { id: 'archetypes', label: 'Archetypes', icon: Sparkles },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                                className={clsx(
                                    "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all",
                                    activeTab === tab.id
                                        ? "bg-white text-gray-900 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                <tab.icon size={16} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <AnimatePresence mode="wait">
                    {/* Gallery Tab */}
                    {activeTab === 'gallery' && (
                        <motion.div
                            key="gallery"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                        >
                            {/* Gallery Grid */}
                            <div className="lg:col-span-2">
                                <div className="glass-panel rounded-3xl p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-lg font-semibold flex items-center gap-2">
                                            <Grid className="w-5 h-5 text-purple-600" />
                                            Cloudinary Gallery
                                            <span className="text-sm font-normal text-gray-500">({galleryImages.length} images)</span>
                                        </h2>
                                        <button
                                            onClick={loadGallery}
                                            disabled={isLoadingGallery}
                                            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                        >
                                            <RefreshCw className={clsx("w-5 h-5 text-gray-500", isLoadingGallery && "animate-spin")} />
                                        </button>
                                    </div>

                                    {isLoadingGallery ? (
                                        <div className="flex items-center justify-center py-20">
                                            <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
                                        </div>
                                    ) : galleryImages.length === 0 ? (
                                        <div className="text-center py-20">
                                            <ImageIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                                            <p className="text-gray-500">No images in gallery</p>
                                            <button
                                                onClick={() => setActiveTab('upload')}
                                                className="mt-4 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                                            >
                                                Upload Images
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                                            {galleryImages.map((image) => (
                                                <div
                                                    key={image.public_id}
                                                    onClick={() => handleSelectGalleryImage(image)}
                                                    className={clsx(
                                                        "relative group cursor-pointer rounded-xl overflow-hidden aspect-square border-2 transition-all",
                                                        selectedGalleryImage?.public_id === image.public_id
                                                            ? "border-purple-500 ring-2 ring-purple-200"
                                                            : "border-transparent hover:border-purple-300"
                                                    )}
                                                >
                                                    <img
                                                        src={image.thumbnail_url || image.url}
                                                        alt=""
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <button
                                                            onClick={(e) => handleDeleteGalleryImage(image.public_id, e)}
                                                            className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    {selectedGalleryImage?.public_id === image.public_id && (
                                                        <div className="absolute top-2 right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                                                            <CheckCircle className="w-4 h-4 text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Selected Image & Actions */}
                            <div className="space-y-6">
                                {/* Selected Preview */}
                                <div className="glass-panel rounded-3xl p-6">
                                    <h3 className="font-semibold mb-4">Selected Image</h3>
                                    {selectedGalleryImage ? (
                                        <div className="space-y-4">
                                            <img
                                                src={selectedGalleryImage.url}
                                                alt=""
                                                className="w-full rounded-xl"
                                            />
                                            <button
                                                onClick={handleAnalyze}
                                                disabled={isAnalyzing}
                                                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-medium hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {isAnalyzing ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Analyzing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye className="w-5 h-5" />
                                                        Analyze Image
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-gray-400">
                                            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p>Select an image from the gallery</p>
                                        </div>
                                    )}
                                </div>

                                {/* Analysis Results */}
                                {analysisResult && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="glass-panel rounded-3xl p-6 space-y-4"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold">Analysis</h3>
                                            <div className={clsx(
                                                "flex items-center gap-1 px-3 py-1 rounded-full text-sm",
                                                analysisResult.approved
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-red-100 text-red-700"
                                            )}>
                                                {analysisResult.approved ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                {analysisResult.approved ? 'Approved' : 'Rejected'}
                                            </div>
                                        </div>

                                        {/* Score */}
                                        <div className="flex items-center gap-4">
                                            <div className={clsx(
                                                "w-16 h-16 rounded-full flex items-center justify-center",
                                                getScoreBg(analysisResult.taste_score?.final_score || 0)
                                            )}>
                                                <span className={clsx("text-xl font-bold", getScoreColor(analysisResult.taste_score?.final_score || 0))}>
                                                    {analysisResult.taste_score?.final_score || 0}
                                                </span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium text-gray-700">Aura Score</p>
                                                {analysisResult.analysis?.mood_description && (
                                                    <p className="text-xs text-gray-500 italic mt-1">
                                                        &ldquo;{analysisResult.analysis.mood_description}&rdquo;
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Family Selection */}
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 mb-2">Tweet Family</p>
                                            <div className="flex flex-wrap gap-2">
                                                {families.slice(0, 5).map((family) => (
                                                    <button
                                                        key={family.family_id}
                                                        onClick={() => setSelectedFamily(family)}
                                                        className={clsx(
                                                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                                            selectedFamily?.family_id === family.family_id
                                                                ? "bg-indigo-500 text-white"
                                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                        )}
                                                    >
                                                        {family.display_name.split(' ')[0]}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Archetype Selection */}
                                        <div>
                                            <p className="text-sm font-medium text-gray-700 mb-2">Archetype</p>
                                            <div className="flex flex-wrap gap-2">
                                                {archetypes.slice(0, 6).map((arch) => (
                                                    <button
                                                        key={arch.archetype_id}
                                                        onClick={() => setSelectedArchetype(arch)}
                                                        className={clsx(
                                                            "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                                            selectedArchetype?.archetype_id === arch.archetype_id
                                                                ? "bg-pink-500 text-white"
                                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                        )}
                                                    >
                                                        {arch.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Generate Button */}
                                        <button
                                            onClick={handleGenerate}
                                            disabled={isGenerating}
                                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:from-indigo-700 hover:to-purple-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isGenerating ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <Wand2 className="w-5 h-5" />
                                                    Generate Tweet
                                                </>
                                            )}
                                        </button>
                                    </motion.div>
                                )}

                                {/* Generated Tweet */}
                                {generatedTweet && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="glass-panel rounded-3xl p-6 space-y-4"
                                    >
                                        <div className="flex items-center justify-between">
                                            <h3 className="font-semibold">Generated Tweet</h3>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={handleGenerate}
                                                    className="p-1.5 rounded-lg hover:bg-gray-100"
                                                    title="Regenerate"
                                                >
                                                    <RefreshCw className="w-4 h-4 text-gray-500" />
                                                </button>
                                                <button
                                                    onClick={copyToClipboard}
                                                    className="p-1.5 rounded-lg hover:bg-gray-100"
                                                    title="Copy"
                                                >
                                                    {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-100">
                                            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                                                {generatedTweet}
                                            </p>
                                        </div>

                                        <div className="text-xs text-gray-400 flex justify-between">
                                            <span>{generatedTweet.length}/280</span>
                                            <div className="flex gap-2">
                                                {selectedFamily && (
                                                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                                                        {selectedFamily.display_name.split(' ')[0]}
                                                    </span>
                                                )}
                                                {selectedArchetype && (
                                                    <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-600">
                                                        {selectedArchetype.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Post Button */}
                                        <button
                                            onClick={handlePostTweet}
                                            disabled={isPosting || !selectedFamily || !selectedArchetype}
                                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:from-emerald-600 hover:to-teal-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg"
                                        >
                                            {isPosting ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    Posting...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="w-5 h-5" />
                                                    Post Tweet & Remove Image
                                                </>
                                            )}
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Upload Tab */}
                    {activeTab === 'upload' && (
                        <motion.div
                            key="upload"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="max-w-2xl mx-auto"
                        >
                            <div className="glass-panel rounded-3xl p-8">
                                <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                    <CloudUpload className="w-5 h-5 text-purple-600" />
                                    Upload to Gallery
                                </h2>

                                <label className={clsx(
                                    "block border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all",
                                    uploadedImage
                                        ? "border-purple-300 bg-purple-50/50"
                                        : "border-gray-300 hover:border-purple-400 hover:bg-purple-50/30"
                                )}>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                        className="hidden"
                                    />
                                    {uploadedImage ? (
                                        <div className="space-y-4">
                                            <img
                                                src={uploadedImage}
                                                alt="Preview"
                                                className="max-h-80 mx-auto rounded-xl shadow-lg"
                                            />
                                            <p className="text-sm text-gray-500">Click to change image</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center">
                                                <Upload className="w-10 h-10 text-purple-600" />
                                            </div>
                                            <p className="text-gray-600 font-medium text-lg">Drop an image or click to upload</p>
                                            <p className="text-sm text-gray-400">JPEG, PNG, WebP up to 10MB</p>
                                        </div>
                                    )}
                                </label>

                                {uploadedImage && (
                                    <button
                                        onClick={handleUploadToGallery}
                                        disabled={isUploadingToGallery}
                                        className="w-full mt-6 py-4 px-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isUploadingToGallery ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Uploading to Cloudinary...
                                            </>
                                        ) : (
                                            <>
                                                <CloudUpload className="w-5 h-5" />
                                                Upload to Gallery
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Families Tab */}
                    {activeTab === 'families' && (
                        <motion.div
                            key="families"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {families.map((family) => (
                                <div key={family.family_id} className="glass-panel rounded-3xl p-6 hover:shadow-lg transition-all">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">{family.display_name}</h3>
                                    <p className="text-sm text-gray-500 mb-4">{family.name}</p>

                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Core Themes</p>
                                            <div className="flex flex-wrap gap-1">
                                                {family.core_themes?.slice(0, 5).map((theme, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs">
                                                        {theme}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Tone Profile</p>
                                            <div className="flex flex-wrap gap-1">
                                                {family.tone_profile?.map((tone, i) => (
                                                    <span key={i} className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs">
                                                        {tone}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}

                    {/* Archetypes Tab */}
                    {activeTab === 'archetypes' && (
                        <motion.div
                            key="archetypes"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            {archetypes.map((arch) => (
                                <div key={arch.archetype_id} className="glass-panel rounded-3xl p-6 hover:shadow-lg transition-all">
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">{arch.name}</h3>

                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Structure</p>
                                            <pre className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl whitespace-pre-wrap">
                                                {arch.template_structure}
                                            </pre>
                                        </div>

                                        {arch.example_tweets?.length > 0 && (
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Example</p>
                                                <p className="text-sm text-gray-700 italic">
                                                    &ldquo;{arch.example_tweets[0]}&rdquo;
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex flex-wrap gap-1">
                                            {arch.tone_requirements?.map((tone, i) => (
                                                <span key={i} className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-xs">
                                                    {tone}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
