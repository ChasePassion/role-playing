"use client";

interface DeleteConfirmDialogProps {
    isOpen: boolean;
    characterName: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDeleting?: boolean;
}

export default function DeleteConfirmDialog({
    isOpen,
    characterName,
    onConfirm,
    onCancel,
    isDeleting = false,
}: DeleteConfirmDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={!isDeleting ? onCancel : undefined}
            />

            {/* Dialog */}
            <div
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-modal-in"
                onClick={(e) => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold text-gray-900 mb-3">确认删除</h2>
                <p className="text-gray-600 mb-6">
                    确定要删除角色 <span className="font-semibold text-gray-900">&quot;{characterName}&quot;</span> 吗？此操作无法撤销。
                </p>

                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isDeleting}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                删除中...
                            </>
                        ) : (
                            "确认删除"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
