"use client";

import { Suspense, useRef, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PortfolioView from "@/components/dashboard/PortfolioView";
import WhatIfSimulation from "@/components/simulation/WhatIfSimulation";
import EmptyState from "@/components/common/EmptyState";
import { usePortfolio } from "@/state/portfolio-context";
import { useCsvImport } from "@/hooks/useCsvImport";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

type Tab = "portfolio" | "simulate";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`h-11 border-b-2 px-4 text-sm font-medium transition-colors ${
        active
          ? "border-accent text-fg"
          : "border-transparent text-fg-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function HomeInner() {
  const { state } = usePortfolio();
  const hasData = state.lots.length > 0 || state.errors.length > 0;
  const router = useRouter();
  const params = useSearchParams();
  const activeTab: Tab =
    params.get("tab") === "simulate" ? "simulate" : "portfolio";

  const { importFile, reading } = useCsvImport();
  const fileRef = useRef<HTMLInputElement>(null);

  // Deep-linking por searchParams: ?tab=simulate queda en la URL.
  const setTab = (tab: Tab) => {
    router.replace(tab === "simulate" ? "?tab=simulate" : "/", {
      scroll: false,
    });
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur">
        <span className="font-semibold tracking-tight text-fg">
          What If Wealth
        </span>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) importFile(file);
              event.target.value = "";
            }}
          />
          <Button variant="primary" onClick={() => fileRef.current?.click()}>
            {reading ? "Reading…" : "Import CSV"}
          </Button>
          <a
            href="/portfolio-sample.csv"
            download="portfolio-sample.csv"
            className="rounded-sm-card px-3 py-1.5 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2"
          >
            Sample CSV
          </a>
        </div>
      </header>

      {hasData ? (
        <>
          <nav
            className="sticky top-14 z-30 flex gap-1 border-b border-border bg-surface px-4"
            aria-label="Views"
          >
            <TabButton
              active={activeTab === "portfolio"}
              onClick={() => setTab("portfolio")}
            >
              Portfolio
              {state.lots.length > 0 ? (
                <Badge tone="neutral" className="ml-2">
                  {state.lots.length}
                </Badge>
              ) : null}
            </TabButton>
            <TabButton
              active={activeTab === "simulate"}
              onClick={() => setTab("simulate")}
            >
              Simulate
            </TabButton>
          </nav>

          <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
            {activeTab === "portfolio" ? <PortfolioView /> : <WhatIfSimulation />}
          </main>
        </>
      ) : (
        <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
          <EmptyState />
        </main>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center border-b border-border bg-surface/90 px-4 backdrop-blur">
            <span className="font-semibold tracking-tight text-fg">
              What If Wealth
            </span>
          </header>
        </div>
      }
    >
      <HomeInner />
    </Suspense>
  );
}
