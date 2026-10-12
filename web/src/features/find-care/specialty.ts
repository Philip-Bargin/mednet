/**
 * Display-side normalisation of provider specialties (free text in provider applications).
 *
 * Only spelling equivalents are folded together — case, spacing, punctuation, "&"/"and" and
 * British/American spellings of the same word. Different specialties are never merged (that would
 * be a clinical taxonomy decision). Backend values are never changed.
 *
 * The directory API filters with one case-insensitive substring (`specialty`/`search` LIKE %x%), so a
 * filter covering several spellings is sent as the longest substring they share. That matches every
 * spelling the person meant and stays a normal, compatible request.
 */

/** British ↔ American spellings of the same stem. Extend only with true spelling equivalents. */
const SPELLINGS: Array<[british: string, american: string]> = [
  ["paediatric", "pediatric"],
  ["gynaecolog", "gynecolog"],
  ["orthopaedic", "orthopedic"],
  ["haematolog", "hematolog"],
  ["anaesthe", "anesthe"],
  ["oesophag", "esophag"],
];

/** Grouping key: lower case, no accents or punctuation, "&" as "and", American spelling. */
export function specialtyKey(name: string): string {
  let key = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['‘’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  for (const [british, american] of SPELLINGS) key = key.replaceAll(british, american);
  return key;
}

export type SpecialtyGroup = { key: string; name: string; count: number; variants: string[] };

/** Groups providers' specialties; the label is the most used spelling (alphabetical on a tie). */
export function groupSpecialties(specialties: Array<string | { specialty: string; providers: number }>): SpecialtyGroup[] {
  const groups = new Map<string, { count: number; spellings: Map<string, number> }>();
  for (const entry of specialties) {
    // A plain name counts once; a server count (`GET /providers/specialties`) counts its providers.
    const [raw, weight] = typeof entry === "string" ? [entry, 1] : [entry.specialty, entry.providers];
    const name = raw.trim().replace(/\s+/g, " ");
    const key = specialtyKey(name);
    if (!key) continue;
    const group = groups.get(key) ?? { count: 0, spellings: new Map<string, number>() };
    group.count += weight;
    group.spellings.set(name, (group.spellings.get(name) ?? 0) + weight);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, { count, spellings }]) => {
    const variants = [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { key, name: variants[0][0], count, variants: variants.map(([name]) => name) };
  });
}

/** The spellings a person may mean by `term` (lower case), e.g. "paediatrics" → both forms. */
function spellingVariants(term: string): string[] {
  let variants = [term.trim().toLowerCase().replace(/\s+/g, " ")];
  variants = variants.flatMap((value) =>
    value.includes("&") ? [value, value.replaceAll(/\s*&\s*/g, " and ")] : / and /.test(value) ? [value, value.replaceAll(" and ", " & ")] : [value],
  );
  for (const [british, american] of SPELLINGS) {
    variants = variants.flatMap((value) => {
      if (value.includes(british)) return [value, value.replaceAll(british, american)];
      if (value.includes(american)) return [value, value.replaceAll(american, british)];
      return [value];
    });
  }
  return [...new Set(variants)];
}

function longestCommonSubstring(values: string[]): string {
  const [shortest, ...rest] = [...values].sort((a, b) => a.length - b.length);
  for (let length = shortest.length; length > 0; length -= 1) {
    for (let start = 0; start + length <= shortest.length; start += 1) {
      const candidate = shortest.slice(start, start + length);
      if (rest.every((value) => value.includes(candidate))) return candidate;
    }
  }
  return "";
}

/**
 * Backend filter for a specialty or search term. Unchanged unless the term has a spelling
 * equivalent; then the shared substring (e.g. "Paediatrics" → "ediatrics") so both spellings match.
 */
export function directoryFilter(term: string): string {
  const trimmed = term.trim();
  const variants = spellingVariants(trimmed);
  if (variants.length < 2) return trimmed;
  const shared = longestCommonSubstring(variants).trim();
  return shared.length >= 4 ? shared : trimmed;
}
