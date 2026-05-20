import type { Metadata, Viewport } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Open Memory Gateway",
  description: "A compact workspace for capturing and editing agent long-term memory.",
};

export const viewport: Viewport = {
  themeColor: "#11161c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
