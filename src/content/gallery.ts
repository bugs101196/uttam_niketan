import type { StaticImageData } from "next/image";
import type { Locale } from "@/i18n/config";
import fireSafetyPoster from "@/assets/gallery/school-life/fire-safety-poster.jpg";
import fireSafetyStudents from "@/assets/gallery/school-life/fire-safety-students.jpg";
import fireSafetyTalk from "@/assets/gallery/school-life/fire-safety-talk.jpg";
import morningAssembly from "@/assets/gallery/school-life/morning-assembly.jpg";
import resultDay from "@/assets/gallery/school-life/result-day.jpg";

// Photo albums shown on the public website, in display order. Add a school photo
// by copying it into src/assets/gallery/<album>/ and listing it here with a
// description in both languages. Only school-approved photos; identifiable
// children only with guardian permission (roadmap §16).

export interface GalleryPhoto {
  image: StaticImageData;
  alt: Record<Locale, string>;
}

export interface GalleryAlbum {
  id: string; // used in the photo page URL
  date?: string; // YYYY-MM-DD, when known
  title: Record<Locale, string>;
  photos: GalleryPhoto[];
  sample?: boolean; // placeholder album, replaced when the school sends photos
}

const photo = (image: StaticImageData, en: string, hi: string): GalleryPhoto => ({ image, alt: { en, hi } });

export const albums: GalleryAlbum[] = [
  {
    id: "school-life",
    title: { en: "School life", hi: "विद्यालय की झलकियाँ" },
    photos: [
      photo(
        morningAssembly,
        "Students in uniform lined up for the morning assembly",
        "प्रार्थना सभा के लिए पंक्ति में खड़े विद्यार्थी",
      ),
      photo(
        resultDay,
        "Students celebrating with their result cards",
        "अपने परीक्षा परिणाम के साथ खुशी मनाते विद्यार्थी",
      ),
    ],
  },
  {
    id: "fire-safety-awareness",
    title: { en: "Fire safety awareness programme", hi: "अग्नि सुरक्षा जागरूकता कार्यक्रम" },
    photos: [
      photo(
        fireSafetyTalk,
        "Fire service officers speaking to students about fire safety",
        "अग्निशमन अधिकारी विद्यार्थियों को अग्नि सुरक्षा के बारे में बताते हुए",
      ),
      photo(
        fireSafetyPoster,
        "An officer showing students the Bihar Fire Service safety poster with emergency numbers 101 and 112",
        "बिहार अग्निशमन सेवा का सुरक्षा पोस्टर और आपातकालीन नंबर 101 व 112 दिखाते अधिकारी",
      ),
      photo(
        fireSafetyStudents,
        "Students listening to the fire safety talk",
        "अग्नि सुरक्षा की जानकारी ध्यान से सुनते विद्यार्थी",
      ),
    ],
  },
];

export function findPhoto(albumId: string, index: number) {
  const album = albums.find((a) => a.id === albumId);
  const photo = album?.photos[index];
  return album && photo ? { album, photo } : undefined;
}
