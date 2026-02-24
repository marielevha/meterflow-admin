"use client";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import { saveSession } from "@/lib/auth/clientSession";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          password,
          platform: "web",
          deviceName: "web-browser",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.error === "role_not_allowed_for_web") {
          setError("Acces web reserve aux profils AGENT, SUPERVISOR et ADMIN.");
        } else {
          setError("Identifiants invalides.");
        }
        return;
      }

      saveSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        role: data.user?.role ?? "",
        user: data.user,
      });

      router.push("/admin");
    } catch {
      setError("Erreur reseau. Reessaie.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full">
      <div className="w-full max-w-md sm:pt-10 mx-auto mb-5">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon />
          Back to landing
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Reserved web access for AGENT, SUPERVISOR and ADMIN.
            </p>
          </div>

          <form onSubmit={onSubmit}>
            <div className="space-y-6">
              <div>
                <Label>
                  Username or email <span className="text-error-500">*</span>
                </Label>
                <Input
                  placeholder="admin001 or admin@meterflow.local"
                  type="text"
                  onChange={(e) => setIdentifier(e.target.value)}
                />
              </div>

              <div>
                <Label>
                  Password <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <span
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                    )}
                  </span>
                </div>
              </div>

              {error && <p className="text-sm text-error-500">{error}</p>}

              <div>
                <Button className="w-full" size="sm" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </div>
            </div>
          </form>

          <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-300">
            Demo credentials after seed: use any seeded staff user with password
            <span className="font-semibold"> ChangeMe@123 </span>
          </div>
        </div>
      </div>
    </div>
  );
}
