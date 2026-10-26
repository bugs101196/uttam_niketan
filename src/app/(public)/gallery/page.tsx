import { ContentPage, contentPageMetadata } from "@/components/layout/content-page";

export const generateMetadata = () => contentPageMetadata("gallery");

export default function GalleryPage() {
  return <ContentPage page="gallery" />;
}
