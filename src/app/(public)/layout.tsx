import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { BreakingBar } from "@/components/site/BreakingBar";

// The breaking ticker reads live data in the shared layout, so public pages
// render dynamically.
export const dynamic = "force-dynamic";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <BreakingBar />
      <main className="container py-6 min-h-[60vh]">{children}</main>
      <Footer />
    </>
  );
}
