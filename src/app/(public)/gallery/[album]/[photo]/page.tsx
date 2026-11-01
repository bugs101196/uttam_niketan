import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { albums, findPhoto } from "@/content/gallery";
import { getI18n } from "@/i18n/server";

// One photo at full size with previous/next links. Plain links rather than a
// script-driven lightbox, so it works on any phone and each photo can be shared.

type Params = Promise<{ album: string; photo: string }>;

function parse(photo: string) {
  return /^\d+$/.test(photo) ? Number(photo) - 1 : -1;
}

export function generateStaticParams() {
  return albums.flatMap((a) => a.photos.map((_, i) => ({ album: a.id, photo: String(i + 1) })));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { album, photo } = await params;
  const found = findPhoto(album, parse(photo));
  if (!found) return {};
  const { locale } = await getI18n();
  return { title: `${found.photo.alt[locale]} · ${found.album.title[locale]}` };
}

export default async function PhotoPage({ params }: { params: Params }) {
  const { album: albumId, photo } = await params;
  const index = parse(photo);
  const found = findPhoto(albumId, index);
  if (!found) notFound();
  const { album } = found;
  const { locale, t } = await getI18n();
  const total = album.photos.length;
  const href = (i: number) => `/gallery/${album.id}/${i + 1}`;
  const nav =
    "flex min-h-12 items-center justify-center rounded-lg border border-border bg-surface px-4 font-semibold text-brand hover:bg-accent-soft";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/gallery" className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline">
        ← {t.gallery.back}
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-brand">{album.title[locale]}</h1>

      <figure className="mt-4">
        <div className="flex justify-center overflow-hidden rounded-xl bg-foreground/90">
          <Image
            src={found.photo.image}
            alt={found.photo.alt[locale]}
            placeholder="blur"
            priority
            sizes="(min-width: 1024px) 960px, 100vw"
            className="max-h-[75dvh] w-auto object-contain"
          />
        </div>
        <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-lg">{found.photo.alt[locale]}</span>
          <span className="text-muted">
            {t.gallery.photoOf.replace("{n}", String(index + 1)).replace("{total}", String(total))}
          </span>
        </figcaption>
      </figure>

      <nav aria-label={album.title[locale]} className="mt-6 grid grid-cols-2 gap-3">
        {index > 0 ? (
          <Link href={href(index - 1)} rel="prev" className={nav}>
            ← {t.gallery.previous}
          </Link>
        ) : (
          <span />
        )}
        {index < total - 1 ? (
          <Link href={href(index + 1)} rel="next" className={nav}>
            {t.gallery.next} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
