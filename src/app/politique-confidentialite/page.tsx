import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage, type LegalData } from "@/components/common/LegalPage";
import { getPage } from "@/lib/cms";


export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage<LegalData>("politique-confidentialite");
  return { title: page?.metaTitle, description: page?.metaDescription };
}

export default async function Page() {
  const page = await getPage<LegalData>("politique-confidentialite");
  if (!page) notFound();
  return <LegalPage page={page} />;
}
