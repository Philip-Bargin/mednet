import type { Metadata } from "next";
import { HomeDirectory } from "@/features/home/home-directory";
import { HomeHero } from "@/features/home/home-hero";
import { HomeAssurances, HomeSteps } from "@/features/home/home-sections";

export const metadata: Metadata = {
  description:
    "Find approved doctors in Liberia, request appointments in person or by text consultation, and keep track of your care with MedNet.",
};

/** Reference: Homepage. Section order and layout follow the reference; content deviations: DESIGN_SYSTEM.md §14. */
export default function Home() {
  return (
    <main id="main-content">
      <HomeHero />
      <div className="bg-surface">
        <HomeDirectory />
      </div>
      <HomeAssurances />
      <HomeSteps />
    </main>
  );
}
