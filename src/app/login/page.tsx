"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, isProfileComplete } from "@/lib/auth-context";
import { sendVerificationCode, getCurrentUser } from "@/lib/api";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [step, setStep] = useState<"email" | "code">("email");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const router = useRouter();

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await sendVerificationCode(email);
            setStep("code");
        } catch (err) {
            const message = err instanceof Error ? err.message : "发送验证码失败";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            await login(email, code);
            // Check if profile is complete to decide redirect destination
            const token = localStorage.getItem("access_token");
            if (token) {
                const user = await getCurrentUser();
                if (isProfileComplete(user)) {
                    router.push("/");
                } else {
                    router.push("/setup");
                }
            } else {
                router.push("/");
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "验证码无效";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">NeuraChar</h1>
                        <p className="text-gray-500">
                            {step === "email"
                                ? "登录以开启您的旅程"
                                : "请输入发送到您邮箱的验证码"}
                        </p>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    {step === "email" ? (
                        <form onSubmit={handleSendCode} className="space-y-6">
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    邮箱地址
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                                    placeholder="name@example.com"
                                    disabled={isLoading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? "正在发送..." : "发送验证码"}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div>
                                <label
                                    htmlFor="code"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    验证码
                                </label>
                                <input
                                    id="code"
                                    type="text"
                                    required
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-center tracking-widest text-lg"
                                    placeholder="123456"
                                    disabled={isLoading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? "正在验证..." : "登录"}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep("email")}
                                className="w-full text-sm text-gray-500 hover:text-gray-700"
                            >
                                ← 返回输入邮箱
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
