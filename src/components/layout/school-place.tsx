import { schoolPin } from "@/lib/school";

/** "Deshrajpur, Mahnar, Vaishali – 844506", never breaking between the dash and the PIN. */
export function SchoolPlace({ place }: { place: string }) {
  return (
    <>
      {place} <span className="whitespace-nowrap">– {schoolPin}</span>
    </>
  );
}
