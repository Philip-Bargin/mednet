import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MedNet | Providers, appointments, and health information",
    template: "%s | MedNet",
  },
  description:
    "Find healthcare providers, request appointments, and keep your health information together with MedNet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={sourceSans.variable}
    >
      <body>{children}</body>
    </html>
  );
}
