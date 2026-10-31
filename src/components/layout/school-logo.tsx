import Image from "next/image";
import logo from "@/assets/logo.png";

// The school emblem. Pass `alt` only where the logo stands alone; next to the
// school's name it is decorative and stays hidden from screen readers.
export function SchoolLogo({ size, alt = "", priority }: { size: number; alt?: string; priority?: boolean }) {
  return (
    <Image
      src={logo}
      alt={alt}
      width={size}
      height={size}
      sizes={`${size}px`}
      priority={priority}
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
