import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalPage, type LegalData } from "@/components/common/LegalPage";
import { getPage } from "@/lib/cms";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage<LegalData>("cgv");
  return { title: page?.metaTitle, description: page?.metaDescription };
}

export default async function Page() {
  const page = await getPage<LegalData>("cgv");
  if (!page) notFound();
  return <LegalPage page={page} />;
}
