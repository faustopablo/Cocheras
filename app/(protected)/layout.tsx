import { requireUser } from "@/lib/auth";
import { Navbar } from "@/components/navbar";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar profile={profile} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 py-6">{children}</div>
      </main>
    </div>
  );
}
