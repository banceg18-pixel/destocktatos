import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Arrow } from "@/components/ui/Primitives";
import { getPost, getPosts } from "@/lib/cms";
import { readingMinutes, sanitizeHtml } from "@/lib/cms/sanitize";
import { SITE_URL, jsonLd } from "@/lib/seo";

export const revalidate = 300;
type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  return (await getPosts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return { title: "Article introuvable", robots: { index: false } };
  return {
    title: post.title,
    description: post.excerpt.slice(0, 300),
    alternates: { canonical: `/conseils/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.excerpt, url: `/conseils/${post.slug}`, images: post.image ? [post.image] : undefined, publishedTime: post.date },
  };
}

const dateFr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export default async function ArticlePage({ params }: { params: Params }) {
  const { slug } = await params;
  const [post, posts] = await Promise.all([getPost(slug), getPosts()]);
  if (!post) notFound();
  const others = posts.filter((p) => p.slug !== post.slug).slice(0, 3);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    dateModified: post.modified ?? post.date,
    image: post.image ? [post.image.startsWith("http") ? post.image : `${SITE_URL}${post.image}`] : undefined,
    mainEntityOfPage: `${SITE_URL}/conseils/${post.slug}`,
  };
  return (
    <article>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ld)} />
      <header className="shell pb-10 pt-8 lg:pt-12">
        <div className="mx-auto max-w-3xl">
          <p className="t-spec text-graphite">{[post.category, dateFr(post.date), `${readingMinutes(post.content)} min de lecture`].filter(Boolean).join(" · ")}</p>
          <h1 className="t-display mt-6 !text-[clamp(2.2rem,5vw,4.2rem)]">{post.title}</h1>
          <p className="t-lead mt-6 text-graphite">{post.excerpt}</p>
        </div>
      </header>
      {post.image && (
        <div className="shell">
          <div className="relative mx-auto aspect-[16/9] max-w-5xl overflow-hidden bg-mist">
            <Image src={post.image} alt={post.imageAlt ?? ""} fill priority sizes="(min-width: 1024px) 64rem, 100vw" className="object-cover" />
          </div>
        </div>
      )}
      <div className="shell py-14 lg:py-20">
        <div className="prose-article mx-auto max-w-3xl" dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.content) }} />
        <div className="mx-auto mt-16 flex max-w-3xl flex-wrap items-center justify-between gap-6 border-t border-line pt-8">
          <p className="text-graphite">Une question sur un appareil ? Nos conseillers vous répondent 7 jours sur 7.</p>
          <ButtonLink href="/contact" variant="outline" icon={<Arrow />}>
            Nous contacter
          </ButtonLink>
        </div>
      </div>
      {others.length > 0 && (
        <section className="border-t border-line py-16 lg:py-20" aria-labelledby="autres-conseils">
          <div className="shell">
            <h2 id="autres-conseils" className="t-h3 mb-8">
              Autres conseils
            </h2>
            <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((p) => (
                <li key={p.slug}>
                  <Link href={`/conseils/${p.slug}`} className="group block">
                    <p className="t-spec text-graphite">{dateFr(p.date)}</p>
                    <h3 className="t-h3 mt-3 group-hover:underline group-hover:underline-offset-4">{p.title}</h3>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </article>
  );
}
