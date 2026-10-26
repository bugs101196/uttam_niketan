import { ContentPage, contentPageMetadata } from "@/components/layout/content-page";

export const generateMetadata = () => contentPageMetadata("academics");

export default function AcademicsPage() {
  return <ContentPage page="academics" />;
}
