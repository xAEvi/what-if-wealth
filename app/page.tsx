"use client";

import CsvDropzone from "@/components/csv/CsvDropzone";
import LotTable from "@/components/csv/LotTable";
import Dashboard from "@/components/dashboard/Dashboard";
import WhatIfSimulation from "@/components/simulation/WhatIfSimulation";
import { usePortfolio } from "@/state/portfolio-context";

export default function Home() {
  const { state } = usePortfolio();
  const hasData = state.lots.length > 0 || state.errors.length > 0;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            What If Wealth
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Import your Yahoo portfolio to run counterfactual investment
            simulations.
          </p>
        </header>

        <CsvDropzone />

        {hasData ? (
          <>
            <LotTable />
            {state.lots.length > 0 && (
              <>
                <Dashboard />
                <WhatIfSimulation />
              </>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Nothing imported yet. Load your Yahoo portfolio CSV to get
              started, or download a sample to explore the tool.
            </p>
            <a
              href="/portfolio-sample.csv"
              download="portfolio-sample.csv"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Download sample CSV
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
