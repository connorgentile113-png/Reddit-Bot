import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Engain — Reddit hot-lead autopilot by Freebuff",
  description:
    "Find Reddit threads already getting views and clicks, comment with your link, and let autopilot do the rest.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
