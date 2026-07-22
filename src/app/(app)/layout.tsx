import { Sidebar } from "@/components/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar />
      <main className="md:pl-56">
        <div className="mx-auto max-w-[1400px] px-5 py-6 md:px-8">{children}</div>
      </main>
    </div>
  );
}
