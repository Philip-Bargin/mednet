import { describe, expect, it } from "vitest";
import { directoryFilter, groupSpecialties, specialtyKey } from "./specialty";

describe("specialty normalisation", () => {
  it("folds only spelling equivalents", () => {
    expect(specialtyKey("  Paediatrics ")).toBe(specialtyKey("pediatrics"));
    expect(specialtyKey("Obstetrics & Gynaecology")).toBe(specialtyKey("obstetrics and gynecology"));
    expect(specialtyKey("Women’s health")).toBe(specialtyKey("womens health"));
    // Different specialties stay apart.
    expect(specialtyKey("Family medicine")).not.toBe(specialtyKey("General medicine"));
    expect(specialtyKey("Pediatric surgery")).not.toBe(specialtyKey("Pediatrics"));
  });

  it("groups variants under the most used spelling and keeps every original value", () => {
    const groups = groupSpecialties(["Pediatrics", "Paediatrics", "pediatrics", "Pediatrics", "Dermatology", " "]);
    expect(groups).toEqual([
      { key: "pediatrics", name: "Pediatrics", count: 4, variants: ["Pediatrics", "Paediatrics", "pediatrics"] },
      { key: "dermatology", name: "Dermatology", count: 1, variants: ["Dermatology"] },
    ]);
  });

  it("sends one substring filter that matches every spelling", () => {
    expect(directoryFilter("Paediatrics")).toBe("ediatrics");
    expect(directoryFilter("Pediatrics")).toBe("ediatrics");
    expect(directoryFilter("Obstetrics & Gynecology")).toBe("obstetrics");
    for (const spelling of ["pediatrics", "paediatrics"]) expect(spelling).toContain(directoryFilter("Paediatrics"));
  });

  it("leaves other terms exactly as typed", () => {
    expect(directoryFilter("  Dermatology ")).toBe("Dermatology");
    expect(directoryFilter("Dr. Cole")).toBe("Dr. Cole");
    expect(directoryFilter("")).toBe("");
  });
});
