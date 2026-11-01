import Image from "next/image";
import Link from "next/link";
import { contentPageMetadata } from "@/components/layout/content-page";
import { PlaceholderBanner } from "@/components/layout/placeholder-banner";
import { albums } from "@/content/gallery";
import { formatNoticeDate } from "@/content/notices";
import { getI18n } from "@/i18n/server";

export const generateMetadata = () => contentPageMetadata("gallery");

export default async function GalleryPage() {
  const { locale, t } = await getI18n();
  const { title, intro } = t.pages.gallery;
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold text-brand sm:text-4xl">{title}</h1>
      <p className="mt-3 text-lg text-muted">{intro}</p>
      {albums.some((a) => a.sample) ? (
        <div className="mt-6">
          <PlaceholderBanner>{t.gallery.samples}</PlaceholderBanner>
        </div>
      ) : null}

      {albums.map((album) => (
        <section key={album.id} aria-labelledby={`album-${album.id}`} className="reveal mt-10">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id={`album-${album.id}`} className="text-2xl font-bold text-brand">
              {album.title[locale]}
            </h2>
            <p className="text-muted">
              <time dateTime={album.date}>{formatNoticeDate(album.date, locale)}</time> · {album.photos.length}{" "}
              {t.gallery.photos}
            </p>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {album.photos.map((photo, i) => (
              <li key={i}>
                <Link
                  href={`/gallery/${album.id}/${i + 1}`}
                  className="group block overflow-hidden rounded-xl border border-border bg-surface focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Image
                    src={photo.image}
                    alt={photo.alt[locale]}
                    placeholder="blur"
                    sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-105 group-focus-visible:scale-105"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
