import Image from "next/image";
import { headers } from "next/headers";
import { cache, Suspense } from "react";

import { auth } from "../lib/auth/config";
import { SignInButton, SignOutButton } from "./auth-controls";
import { SearchPanel } from "./search";

type HeaderUser = { name: string; image?: string | null } | null;

const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-[#0a0a0a] text-zinc-100">
      <Suspense fallback={<PageFallback />}>
        <HomeContent />
      </Suspense>
    </div>
  );
}

async function HomeContent() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <>
      <Header user={session?.user ?? null} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-12">
        <SearchPanel
          key={session?.user.id ?? "signed-out"}
          isSignedIn={Boolean(session)}
        />
      </main>
    </>
  );
}

function Header({ user }: { user: HeaderUser }) {
  return (
    <header className="flex min-h-18 items-center justify-end gap-4 border-b border-white/10 px-6">
      {user ? (
        <>
          <span className="max-w-48 truncate text-sm text-zinc-300">
            {user.name}
          </span>
          {user.image ? (
            <Image
              src={user.image}
              alt={user.name}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-white/20"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-sm font-medium text-zinc-200">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <SignOutButton />
        </>
      ) : (
        <SignInButton />
      )}
    </header>
  );
}

function PageFallback() {
  return (
    <>
      <header className="flex min-h-18 items-center justify-end gap-4 border-b border-white/10 px-6">
        <div className="h-9 w-28 animate-pulse rounded-full bg-white/10" />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
        <div className="h-14 w-full animate-pulse rounded-xl bg-white/5" />
      </main>
    </>
  );
}
