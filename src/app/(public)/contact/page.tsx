import { ContentPage, contentPageMetadata } from "@/components/layout/content-page";

export const generateMetadata = () => contentPageMetadata("contact");

export default function ContactPage() {
  return <ContentPage page="contact" />;
}
