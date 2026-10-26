import { ContentPage, contentPageMetadata } from "@/components/layout/content-page";

export const generateMetadata = () => contentPageMetadata("admissions");

export default function AdmissionsPage() {
  return <ContentPage page="admissions" />;
}
