"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface AvatarCropperProps {
    file: File;
    onConfirm: (croppedBlob: Blob) => void;
    onCancel: () => void;
}

interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export default function AvatarCropper({ file, onConfirm, onCancel }: AvatarCropperProps) {
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // Crop rect in PERCENTAGE relative to the displayed image
    // Storing as pixels usually easier for logic, let's store as pixels relative to displayed image
    const [cropRect, setCropRect] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 });

    // Interaction state
    const [isDragging, setIsDragging] = useState(false);
    const [dragType, setDragType] = useState<"move" | "nw" | "ne" | "sw" | "se" | null>(null);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 }); // Mouse/Touch start pos
    const [startRect, setStartRect] = useState<Rect>({ x: 0, y: 0, width: 0, height: 0 });

    useEffect(() => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setImageSrc(e.target?.result as string);
        };
        reader.readAsDataURL(file);
    }, [file]);

    // Initialize crop rect when image loads
    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const size = Math.min(width, height) * 0.8;
        setCropRect({
            x: (width - size) / 2,
            y: (height - size) / 2,
            width: size,
            height: size,
        });
    };

    const getClientPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
        if ("touches" in e) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
    };

    const handlePointerDown = (
        e: React.MouseEvent | React.TouchEvent,
        type: "move" | "nw" | "ne" | "sw" | "se"
    ) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
        setDragType(type);
        setStartPos(getClientPos(e.nativeEvent as MouseEvent | TouchEvent)); // React Type casting
        setStartRect(cropRect);
    };

    const handlePointerMove = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isDragging || !dragType || !imgRef.current) return;

        const currentPos = getClientPos(e);
        const deltaX = currentPos.x - startPos.x;
        const deltaY = currentPos.y - startPos.y;

        const imgWidth = imgRef.current.clientWidth;
        const imgHeight = imgRef.current.clientHeight;

        let newRect = { ...startRect };

        if (dragType === "move") {
            newRect.x = Math.max(0, Math.min(imgWidth - newRect.width, startRect.x + deltaX));
            newRect.y = Math.max(0, Math.min(imgHeight - newRect.height, startRect.y + deltaY));
        } else {
            // Resize logic keeping aspect ratio 1:1
            // This is simplified, usually implies complex math for each corner
            // For 1:1, width change must equal height change

            // Simplified approach: Just regular resize, then enforce square? 
            // Better: Enforce 1:1 during delta calculation

            if (dragType === "se") {
                // Bottom-right
                const maxD = Math.min(imgWidth - startRect.x, imgHeight - startRect.y) - startRect.width;
                // We want delta to be uniform
                const d = Math.max(20 - startRect.width, Math.min(maxD, Math.max(deltaX, deltaY)));
                newRect.width = startRect.width + d;
                newRect.height = startRect.height + d;
            } else if (dragType === "sw") {
                // Bottom-left: x changes, width changes, y constant, height changes
                // width change = -deltaX
                // height change = width change (to keep square)
                // Constraint: x >= 0, width >= 20, y+height <= imgHeight

                // Let's use a simpler clamp approach
                // Calculate potential new width based on mouse x
                const newW = Math.max(20, Math.min(startRect.x + startRect.width, startRect.width - deltaX));
                // Ensure it fits vertically
                const clampedW = Math.min(newW, imgHeight - startRect.y);

                newRect.x = startRect.x + startRect.width - clampedW;
                newRect.width = clampedW;
                newRect.height = clampedW;
            } else if (dragType === "ne") {
                // Top-right: y changes, height changes, x constant, width changes
                const newW = Math.max(20, Math.min(imgWidth - startRect.x, startRect.width + deltaX));
                const clampedW = Math.min(newW, startRect.y + startRect.height);

                newRect.y = startRect.y + startRect.height - clampedW;
                newRect.width = clampedW;
                newRect.height = clampedW;
            } else if (dragType === "nw") {
                // Top-left
                const newW = Math.max(20, Math.min(startRect.x + startRect.width, startRect.width - deltaX));
                const clampedW = Math.min(newW, startRect.y + startRect.height);

                newRect.x = startRect.x + startRect.width - clampedW;
                newRect.y = startRect.y + startRect.height - clampedW;
                newRect.width = clampedW;
                newRect.height = clampedW;
            }
        }

        setCropRect(newRect);
    }, [isDragging, dragType, startPos, startRect]);

    const handlePointerUp = useCallback(() => {
        setIsDragging(false);
        setDragType(null);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener("mousemove", handlePointerMove);
            window.addEventListener("touchmove", handlePointerMove);
            window.addEventListener("mouseup", handlePointerUp);
            window.addEventListener("touchend", handlePointerUp);
        }
        return () => {
            window.removeEventListener("mousemove", handlePointerMove);
            window.removeEventListener("touchmove", handlePointerMove);
            window.removeEventListener("mouseup", handlePointerUp);
            window.removeEventListener("touchend", handlePointerUp);
        };
    }, [isDragging, handlePointerMove, handlePointerUp]);

    const handleConfirm = () => {
        if (!imgRef.current) return;

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Map displayed coords to natural image coords
        const scaleX = imgRef.current.naturalWidth / imgRef.current.clientWidth;
        const scaleY = imgRef.current.naturalHeight / imgRef.current.clientHeight;

        const realX = cropRect.x * scaleX;
        const realY = cropRect.y * scaleY;
        const realW = cropRect.width * scaleX;
        const realH = cropRect.height * scaleY;

        canvas.width = 400; // Output size
        canvas.height = 400;

        ctx.drawImage(
            imgRef.current,
            realX, realY, realW, realH,
            0, 0, 400, 400
        );

        canvas.toBlob((blob) => {
            if (blob) {
                onConfirm(blob);
            }
        }, "image/jpeg", 0.9);
    };

    if (!imageSrc) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-modal-in"
            onClick={(e) => e.stopPropagation()}
        >
            <div
                className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                    <h3 className="text-lg font-bold text-gray-900">调整头像</h3>
                    <button onClick={onCancel} className="text-gray-500 hover:text-gray-700">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div
                    ref={containerRef}
                    className="flex-1 overflow-hidden bg-gray-900 relative flex items-center justify-center select-none"
                    style={{ minHeight: "300px", touchAction: "none" }}
                >
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt="Crop target"
                        className="max-w-full max-h-[60vh] object-contain pointer-events-none"
                        onLoad={handleImageLoad}
                    />

                    {/* Dark overlay outside crop area */}
                    {/* We can't easily do a pure css overlay with a hole in the middle for dynamic size without complex clip-path or 4 divs.
                        Use 4 divs approach for simplicity over the image container
                     */}


                    {imgRef.current && (
                        <>
                            {/* Single overlay with rounded cutout using box-shadow */}
                            <div
                                className="absolute border-2 border-white cursor-move rounded-lg overflow-hidden pointer-events-none"
                                style={{
                                    left: imgRef.current.offsetLeft + cropRect.x,
                                    top: imgRef.current.offsetTop + cropRect.y,
                                    width: cropRect.width,
                                    height: cropRect.height,
                                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                                }}
                            />

                            {/* Crop Box - Interactive layer */}
                            <div
                                className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)] cursor-move rounded-lg overflow-hidden"
                                style={{
                                    left: imgRef.current.offsetLeft + cropRect.x,
                                    top: imgRef.current.offsetTop + cropRect.y,
                                    width: cropRect.width,
                                    height: cropRect.height,
                                }}
                                onMouseDown={(e) => handlePointerDown(e, "move")}
                                onTouchStart={(e) => handlePointerDown(e, "move")}
                            >
                                {/* Grid lines (optional aesthetic) */}
                                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                                    <div className="border-r border-white/50 h-full col-start-2" />
                                    <div className="border-r border-white/50 h-full col-start-3" />
                                    <div className="border-b border-white/50 w-full row-start-2 col-span-3 absolute top-1/3" />
                                    <div className="border-b border-white/50 w-full row-start-3 col-span-3 absolute top-2/3" />
                                </div>

                                {/* Drag Handles */}
                                <div
                                    className="absolute -top-2 -left-2 w-5 h-5 border-t-4 border-l-4 border-white cursor-nw-resize"
                                    onMouseDown={(e) => handlePointerDown(e, "nw")}
                                    onTouchStart={(e) => handlePointerDown(e, "nw")}
                                />
                                <div
                                    className="absolute -top-2 -right-2 w-5 h-5 border-t-4 border-r-4 border-white cursor-ne-resize"
                                    onMouseDown={(e) => handlePointerDown(e, "ne")}
                                    onTouchStart={(e) => handlePointerDown(e, "ne")}
                                />
                                <div
                                    className="absolute -bottom-2 -left-2 w-5 h-5 border-b-4 border-l-4 border-white cursor-sw-resize"
                                    onMouseDown={(e) => handlePointerDown(e, "sw")}
                                    onTouchStart={(e) => handlePointerDown(e, "sw")}
                                />
                                <div
                                    className="absolute -bottom-2 -right-2 w-5 h-5 border-b-4 border-r-4 border-white cursor-se-resize"
                                    onMouseDown={(e) => handlePointerDown(e, "se")}
                                    onTouchStart={(e) => handlePointerDown(e, "se")}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white z-10">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl text-gray-600 hover:bg-gray-100 font-medium transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-6 py-2 rounded-xl bg-[#3964FE] text-white font-medium hover:bg-[#2a4fd6] transition-colors shadow-lg shadow-blue-500/30"
                    >
                        确认使用
                    </button>
                </div>
            </div>
        </div>
    );
}
