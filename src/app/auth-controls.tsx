"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "../lib/auth/client";

/**
 * Renders a GitHub sign-in button that redirects to the home page after sign-in.
 * Displays sign-in errors and re-enables the button when an attempt fails.
 */
export function SignInButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={isLoading}
        onClick={async () => {
          setIsLoading(true);
          setError(null);
          try {
            // Redirects to GitHub, then back to the callback URL.
            const { error } = await authClient.signIn.social({
              provider: "github",
              callbackURL: "/",
            });
            if (error) {
              setError(
                error.message ||
                  "Could not start GitHub sign-in. Please try again.",
              );
              setIsLoading(false);
            }
          } catch (cause) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Could not start GitHub sign-in. Please try again.",
            );
            setIsLoading(false);
          }
        }}
        className="flex h-11 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {isLoading ? "Redirecting…" : "Sign in with GitHub"}
      </button>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={async () => {
        setIsLoading(true);
        await authClient.signOut({
          fetchOptions: {
            onSuccess: () => {
              router.refresh();
            },
          },
        });
        setIsLoading(false);
      }}
      className="flex h-11 items-center justify-center rounded-full border border-solid border-white/15 px-6 text-sm font-medium transition-colors hover:border-white/25 hover:bg-white/10 disabled:opacity-60"
    >
      {isLoading ? "Signing out…" : "Sign out"}
    </button>
  );
}
