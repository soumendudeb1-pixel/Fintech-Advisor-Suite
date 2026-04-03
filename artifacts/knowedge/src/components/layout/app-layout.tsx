import { Navbar } from "./navbar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground selection:bg-primary/30">
      <Navbar />
      <main className="flex-1 container max-w-screen-2xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
