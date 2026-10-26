import { ContentPage, contentPageMetadata } from "@/components/layout/content-page";

export const generateMetadata = () => contentPageMetadata("about");

export default function AboutPage() {
  return <ContentPage page="about" />;
}
