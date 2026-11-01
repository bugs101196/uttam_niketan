import type { StaticImageData } from "next/image";
import type { Locale } from "@/i18n/config";
import sample1 from "@/assets/gallery/sample/sample-1.jpg";
import sample2 from "@/assets/gallery/sample/sample-2.jpg";
import sample3 from "@/assets/gallery/sample/sample-3.jpg";
import sample4 from "@/assets/gallery/sample/sample-4.jpg";
import sample5 from "@/assets/gallery/sample/sample-5.jpg";
import sample6 from "@/assets/gallery/sample/sample-6.jpg";
import sample7 from "@/assets/gallery/sample/sample-7.jpg";

// Photo albums shown on the public website, newest first. Add a school photo
// by copying it into src/assets/gallery/<album>/ and listing it here with a
// description in both languages. Only school-approved photos; identifiable
// children only with guardian permission (roadmap §16).

export interface GalleryPhoto {
  image: StaticImageData;
  alt: Record<Locale, string>;
}

export interface GalleryAlbum {
  id: string; // used in the photo page URL
  date: string; // YYYY-MM-DD
  title: Record<Locale, string>;
  photos: GalleryPhoto[];
  sample?: boolean; // placeholder album, replaced when the school sends photos
}

const sample = (image: StaticImageData, en: string, hi: string): GalleryPhoto => ({ image, alt: { en, hi } });

export const albums: GalleryAlbum[] = [
  {
    id: "sample-events",
    date: "2026-10-15",
    sample: true,
    title: { en: "School events (sample)", hi: "विद्यालय के कार्यक्रम (नमूना)" },
    photos: [
      sample(sample4, "Sample photo: morning assembly", "नमूना चित्र: प्रार्थना सभा"),
      sample(sample5, "Sample photo: sports day", "नमूना चित्र: खेल दिवस"),
      sample(sample6, "Sample photo: annual function", "नमूना चित्र: वार्षिक समारोह"),
      sample(sample7, "Sample photo: cultural programme", "नमूना चित्र: सांस्कृतिक कार्यक्रम"),
    ],
  },
  {
    id: "sample-campus",
    date: "2026-09-01",
    sample: true,
    title: { en: "Our campus (sample)", hi: "हमारा विद्यालय परिसर (नमूना)" },
    photos: [
      sample(sample1, "Sample photo: school building", "नमूना चित्र: विद्यालय भवन"),
      sample(sample2, "Sample photo: classroom", "नमूना चित्र: कक्षा"),
      sample(sample3, "Sample photo: school garden", "नमूना चित्र: विद्यालय का बगीचा"),
    ],
  },
];

export function findPhoto(albumId: string, index: number) {
  const album = albums.find((a) => a.id === albumId);
  const photo = album?.photos[index];
  return album && photo ? { album, photo } : undefined;
}
