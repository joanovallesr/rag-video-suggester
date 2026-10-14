import Image from "next/image";
import { headers } from "next/headers";
import { Suspense } from "react";

import { auth } from "../lib/auth/config";
import { SignInButton, SignOutButton } from "./auth-controls";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 font-sans dark:bg-black">
      <main className="flex w-full max-w-md flex-col items-center gap-8 rounded-2xl border border-black/[.06] bg-white px-8 py-12 text-center shadow-sm dark:border-white/[.08] dark:bg-zinc-950">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            RAG Video Suggester
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sign in to get started.
          </p>
        </div>

        <Suspense
          fallback={
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
          }
        >
          <AuthSection />
        </Suspense>
      </main>
    </div>
  );
}

async function AuthSection() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return <SignInButton />;
  }

  const { user } = session;

  return (
    <div className="flex flex-col items-center gap-4">
      {user.image ? (
        <Image
          src={user.image}
          alt={user.name}
          width={96}
          height={96}
          className="h-24 w-24 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-200 text-3xl font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {user.name?.charAt(0).toUpperCase() ?? "?"}
        </div>
      )}

      <p className="text-lg font-medium text-black dark:text-zinc-50">
        {user.name}
      </p>

      <SignOutButton />
    </div>
  );
}
