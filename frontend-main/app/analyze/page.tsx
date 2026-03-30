"use client";
import dynamic from "next/dynamic";

const AnalyzeToolPage = dynamic(() => import("@/components/analyze/AnalyzeToolPage"), { ssr: false });

export default function AnalyzePage() {
  return <AnalyzeToolPage />;
}
