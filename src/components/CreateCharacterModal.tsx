"use client";

import { useState, useRef, ChangeEvent } from "react";
import Image from "next/image";
import { createCharacter, uploadFile, CreateCharacterRequest } from "@/lib/api";
import AvatarCropper from "./AvatarCropper";

interface CreateCharacterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

// Tag colors for custom tags (shared with CharacterCard)
const TAG_COLORS = [
    { name: "blue", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
    { name: "pink", bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-200" },
    { name: "purple", bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
    { name: "cyan", bg: "bg-cyan-50", text: "text-cyan-600", border: "border-cyan-200" },
    { name: "amber", bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-200" },
    { name: "green", bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
];

export default function CreateCharacterModal({
    isOpen,
    onClose,
    onSuccess,
}: CreateCharacterModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [greetingMessage, setGreetingMessage] = useState("");
    const [systemPrompt, setSystemPrompt] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [selectedTags, setSelectedTags] = useState<{ label: string; color: typeof TAG_COLORS[0] }[]>([]);
    const [isPublic, setIsPublic] = useState(true);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null); // For cropper
    const [isUploading, setIsUploading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset file input value so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }

        setSelectedFile(file);
    };

    const handleCropConfirm = async (croppedBlob: Blob) => {
        setSelectedFile(null); // Close cropper
        setIsUploading(true);
        setError(null);

        try {
            const token = localStorage.getItem("access_token");
            if (!token) throw new Error("请先登录");

            // Convert blob to file
            const file = new File([croppedBlob], "avatar.jpg", { type: "image/jpeg" });

            // Preview locally
            const previewUrl = URL.createObjectURL(croppedBlob);
            setAvatarPreview(previewUrl);

            const result = await uploadFile(file, token);
            setAvatarUrl(result.url);
        } catch (err) {
            setError(err instanceof Error ? err.message : "上传失败");
            setAvatarPreview(null);
        } finally {
            setIsUploading(false);
        }
    };

    const handleCropCancel = () => {
        setSelectedFile(null);
    };

    const handleAddTag = () => {
        const trimmedTag = tagInput.trim();

        // Validation
        if (!trimmedTag) {
            setError("标签输入不能为空");
            return;
        }

        if (trimmedTag.length < 1 || trimmedTag.length > 4) {
            setError("标签长度必须在 1-4 个字符之间");
            return;
        }

        if (selectedTags.length >= 3) {
            setError("最多只能设置 3 个标签");
            return;
        }

        if (selectedTags.some(tag => tag.label === trimmedTag)) {
            setError("此标签已经添加过了");
            return;
        }

        // Add tag with color based on position (ensures no duplicates)
        const colorIndex = selectedTags.length % TAG_COLORS.length;
        setSelectedTags(prev => [...prev, { label: trimmedTag, color: TAG_COLORS[colorIndex] }]);
        setTagInput("");
        setError(null);
    };

    const handleRemoveTag = (tagLabel: string) => {
        setSelectedTags(prev => prev.filter(tag => tag.label !== tagLabel));
    };

    const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleAddTag();
        }
    };

    const handleSubmit = async () => {
        // Validation
        if (!name.trim()) {
            setError("请填写角色名称");
            return;
        }
        if (!description.trim()) {
            setError("请填写角色描述");
            return;
        }
        if (description.trim().length > 35) {
            setError("角色描述需限制在 35 字以内");
            return;
        }
        if (!systemPrompt.trim()) {
            setError("请填写系统提示词");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const token = localStorage.getItem("access_token");
            if (!token) throw new Error("请先登录");

            const data: CreateCharacterRequest = {
                name: name.trim(),
                description: description.trim(),  // Card display description (REQUIRED)
                system_prompt: systemPrompt.trim(),
                greeting_message: greetingMessage.trim() || undefined,  // Chat opening (OPTIONAL)
                avatar_url: avatarUrl || undefined,
                tags: selectedTags.length > 0 ? selectedTags.map(tag => tag.label) : undefined,
                is_public: isPublic,
            };

            console.log('📤 Creating character with data:', data);
            await createCharacter(data, token);

            // Reset form
            setName("");
            setDescription("");
            setGreetingMessage("");
            setSystemPrompt("");
            setSelectedTags([]);
            setIsPublic(true);
            setAvatarUrl(null);
            setAvatarPreview(null);

            onSuccess();
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "创建角色失败");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClose = () => {
        if (!isSubmitting) {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
        >
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={handleClose}
            />

            {/* Modal */}
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 h-[90vh] max-h-[800px] flex flex-col overflow-hidden animate-modal-in"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header - Fixed */}
                <div className="flex-none flex items-center justify-between p-5 border-b border-gray-100 bg-white z-10">
                    <h2 className="text-xl font-bold text-gray-900">创建新角色</h2>
                    <button
                        onClick={handleClose}
                        className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                        disabled={isSubmitting}
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-5 custom-scrollbar">
                    {/* Error message */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Avatar upload */}
                    <div className="flex flex-col items-center">
                        <div
                            onClick={handleAvatarClick}
                            className="relative w-24 h-24 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all overflow-hidden"
                        >
                            {avatarPreview ? (
                                <Image
                                    src={avatarPreview}
                                    alt="Avatar preview"
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    <span className="text-xs mt-1">上传头像</span>
                                </div>
                            )}
                            {isUploading && (
                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            角色名称 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="给角色起个名字"
                            maxLength={100}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                    </div>

                    {/* Description - Required */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            角色描述 <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="简短描述角色特点（最多35个字符）"
                            maxLength={35}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {description.length}/35 字符，将显示在角色卡片上
                        </p>
                    </div>

                    {/* Greeting Message - Optional */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            开场问候语
                        </label>
                        <input
                            type="text"
                            value={greetingMessage}
                            onChange={(e) => setGreetingMessage(e.target.value)}
                            placeholder="角色的第一句话（选填）"
                            maxLength={200}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            聊天时角色主动发送的第一条消息
                        </p>
                    </div>

                    {/* System prompt */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            系统提示词 <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            placeholder="定义角色的性格、背景和行为方式..."
                            rows={4}
                            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                        />
                    </div>

                    {/* Tags - Custom Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            添加标签（最多3个，1-4个字）
                        </label>

                        {/* Input with inline add button */}
                        <div className="flex gap-2 mb-3">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={handleTagInputKeyDown}
                                    placeholder="输入标签名称..."
                                    maxLength={4}
                                    disabled={selectedTags.length >= 3}
                                    className="w-full px-4 py-2.5 pr-12 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:bg-gray-100 disabled:cursor-not-allowed"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddTag}
                                    disabled={selectedTags.length >= 3 || !tagInput.trim()}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                                >
                                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Display added tags */}
                        {selectedTags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {selectedTags.map((tag, index) => (
                                    <div
                                        key={index}
                                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border flex items-center gap-1.5 ${tag.color.bg} ${tag.color.text} ${tag.color.border}`}
                                    >
                                        <span>#{tag.label}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTag(tag.label)}
                                            className="hover:opacity-70 transition-opacity"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Public toggle */}
                    <div className="flex items-center justify-between py-2">
                        <div>
                            <span className="text-sm font-medium text-gray-700">公开角色</span>
                            <p className="text-xs text-gray-500 mt-0.5">公开后其他用户可以在市场中看到</p>
                        </div>
                        <button
                            onClick={() => setIsPublic(!isPublic)}
                            className={`relative w-12 h-6 rounded-full transition-colors ${isPublic ? "bg-blue-600" : "bg-gray-300"
                                }`}
                        >
                            <div
                                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isPublic ? "translate-x-6" : "translate-x-0"
                                    }`}
                            />
                        </button>
                    </div>
                </div>

                {/* Footer - Fixed */}
                <div className="flex-none flex gap-3 p-5 border-t border-gray-100 bg-white z-10">
                    <button
                        onClick={handleClose}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || isUploading}
                        className="flex-1 px-4 py-2.5 bg-[#3964FE] text-white rounded-xl font-medium hover:bg-[#2a4fd6] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                创建中...
                            </>
                        ) : (
                            "创建角色"
                        )}
                    </button>
                </div>
            </div>

            {/* Cropper Modal */}
            {
                selectedFile && (
                    <AvatarCropper
                        file={selectedFile}
                        onConfirm={handleCropConfirm}
                        onCancel={handleCropCancel}
                    />
                )
            }
        </div >
    );
}
