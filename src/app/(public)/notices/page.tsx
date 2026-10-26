import { ContentPage, contentPageMetadata } from "@/components/layout/content-page";

export const generateMetadata = () => contentPageMetadata("notices");

export default function NoticesPage() {
  return <ContentPage page="notices" />;
}
