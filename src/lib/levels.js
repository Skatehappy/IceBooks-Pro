// Skill-level dropdown data for students: ISI, U.S. Figure Skating (USFSA) and Learn to Skate USA.
//
// Started from the legacy 2.x lists (legacy/bundle-readable.reference.js lines ~60-304) and verified/completed
// against the official program pages (checked 2026-11):
//  - ISI: skateisi.org/programs/testing-requirements + 2026 rule revisions (Special Skater 1-10 became the
//    Accessible Skater program: Levels 1-10 plus Emerald, Topaz, Ruby, Sapphire).
//  - U.S. Figure Skating: test structure renamed July 1 2023 (Moves in the Field -> Skating Skills,
//    Free Skate -> Singles, Pre-Juvenile..Senior -> Pre-Bronze..Gold); adult track 21+ / 50+;
//    adaptive tests Pre-Bronze..Gold; "all tests offer an equivalent Skate United test".
//  - Learn to Skate USA: learntoskateusa.com curriculum pages (Snowplow Sam 1-4, Basic 1-6, Pre-Free Skate +
//    Free Skate 1-6 ("seven progressive levels"), Adult 1-6, Hockey 1-4 + Power Skating, Dance 1-6,
//    Artistry in Motion 1-4, Synchro 1-4, Pairs 1-4, Speed Skating 1-6, Adaptive Skating badges 1-12,
//    Special Olympics badges 1-12).
//
// Each group: { key (students DB column), label, program: 'ISI'|'USFSA'|'LTS', section, options } where
// options is either an array of strings or an array of optgroups [{ label, options: [...] }].

const range = (n, fmt) => Array.from({ length: n }, (_, i) => fmt(i + 1));
const withAges = (levels) => levels.flatMap((lv) => [`${lv} (21+)`, `${lv} (50+)`]);

export const PROGRAMS = [
  { id: 'ISI', title: 'ISI Skill Levels', color: '#1e40af', numberKey: 'isi_number', numberLabel: 'ISI Membership Number' },
  { id: 'USFSA', title: 'U.S. Figure Skating (USFSA)', color: '#047857', numberKey: 'usfsa_number', numberLabel: 'USFSA Membership Number' },
  { id: 'LTS', title: 'Learn to Skate USA', color: '#b45309', numberKey: 'lts_number', numberLabel: 'Learn to Skate USA Membership Number' },
];

const USFS_STANDARD_8 = ['Pre-Preliminary', 'Preliminary', 'Pre-Bronze', 'Bronze', 'Pre-Silver', 'Silver', 'Pre-Gold', 'Gold'];
const USFS_DANCE_8 = ['Preliminary', 'Pre-Bronze', 'Bronze', 'Pre-Silver', 'Silver', 'Pre-Gold', 'Gold', 'International'];
const USFS_BRONZE_GOLD_5 = ['Bronze', 'Pre-Silver', 'Silver', 'Pre-Gold', 'Gold'];

export const LEVEL_GROUPS = [
  // ---------------- ISI ----------------
  {
    key: 'isi_freestyle', label: 'ISI Freestyle', program: 'ISI', section: 'ISI',
    options: [...range(4, (i) => `Tot ${i}`), 'Pre-Alpha', 'Alpha', 'Beta', 'Gamma', 'Delta', ...range(10, (i) => `Freestyle ${i}`)],
  },
  { key: 'isi_open_freestyle', label: 'ISI Open Freestyle', program: 'ISI', section: 'ISI', options: ['Bronze', 'Silver', 'Gold', 'Platinum'] },
  { key: 'isi_figures', label: 'ISI Figures', program: 'ISI', section: 'ISI', options: range(10, (i) => `Figure ${i}`) },
  { key: 'isi_couples', label: 'ISI Couples', program: 'ISI', section: 'ISI', options: range(10, (i) => `Couple ${i}`) },
  { key: 'isi_pairs', label: 'ISI Pairs', program: 'ISI', section: 'ISI', options: range(10, (i) => `Pair ${i}`) },
  { key: 'isi_icedance', label: 'ISI Ice Dance', program: 'ISI', section: 'ISI', options: range(10, (i) => `Ice Dance ${i}`) },
  {
    key: 'isi_international_dance', label: 'ISI International Dance', program: 'ISI', section: 'ISI',
    options: ['Rhumba', 'Austrian Waltz', 'Cha Cha Congelado', 'Yankee Polka', 'Ravensburger Waltz', 'Tango Romantica',
      'Silver Samba', 'Golden Waltz', 'Midnight Blues', 'Finnstep', 'Tea-Time Foxtrot'],
  },
  { key: 'isi_freedance_partnered', label: 'ISI Free Dance (Partnered)', program: 'ISI', section: 'ISI', options: range(10, (i) => `Free Dance ${i}`) },
  { key: 'isi_solo_freedance', label: 'ISI Open Solo Free Dance', program: 'ISI', section: 'ISI', options: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'] },
  { key: 'isi_synchro', label: 'ISI Synchro', program: 'ISI', section: 'ISI', options: range(4, (i) => `Synchro ${i}`) },
  {
    key: 'isi_special_skater', label: 'ISI Accessible Skater (formerly Special Skater)', program: 'ISI', section: 'ISI',
    options: [...range(10, (i) => `Accessible Skater ${i}`), 'Emerald', 'Topaz', 'Ruby', 'Sapphire'],
  },

  // ---------------- USFSA: standard track ----------------
  { key: 'usfsa_aspire', label: 'Aspire 1-4', program: 'USFSA', section: 'Standard Track', options: range(4, (i) => `Aspire ${i}`) },
  { key: 'usfsa_skating_skills', label: 'Skating Skills', program: 'USFSA', section: 'Standard Track', options: USFS_STANDARD_8 },
  { key: 'usfsa_singles', label: 'Singles', program: 'USFSA', section: 'Standard Track', options: USFS_STANDARD_8 },
  {
    key: 'usfsa_pattern_dance', label: 'Pattern Dance', program: 'USFSA', section: 'Standard Track',
    options: USFS_DANCE_8.flatMap((lv) => [`${lv} (Partnered - Lead)`, `${lv} (Partnered - Follow)`, `${lv} (Solo - Lead)`, `${lv} (Solo - Follow)`]),
  },
  {
    key: 'usfsa_free_dance', label: 'Free Dance', program: 'USFSA', section: 'Standard Track',
    options: USFS_BRONZE_GOLD_5.flatMap((lv) => [`${lv} (Partnered)`, `${lv} (Solo)`]),
  },
  { key: 'usfsa_pairs', label: 'Pairs', program: 'USFSA', section: 'Standard Track', options: USFS_BRONZE_GOLD_5 },

  // ---------------- USFSA: adult track (21+ / 50+ standards) ----------------
  {
    key: 'usfsa_adult_skating_skills', label: 'Adult Skating Skills (21+ or 50+)', program: 'USFSA', section: 'Adult Track',
    options: withAges(['Pre-Bronze', 'Bronze', 'Silver', 'Gold', 'Intermediate', 'Novice', 'Junior', 'Senior']),
  },
  {
    key: 'usfsa_adult_singles', label: 'Adult Singles (21+ or 50+)', program: 'USFSA', section: 'Adult Track',
    options: withAges(['Pre-Bronze', 'Bronze', 'Silver', 'Gold', 'Intermediate', 'Novice', 'Junior', 'Senior']),
  },
  { key: 'usfsa_adult_pattern_dance', label: 'Adult Pattern Dance (21+ or 50+)', program: 'USFSA', section: 'Adult Track', options: withAges(USFS_DANCE_8) },
  { key: 'usfsa_adult_free_dance', label: 'Adult Partnered Free Dance (21+ or 50+)', program: 'USFSA', section: 'Adult Track', options: withAges(['Pre-Bronze', 'Bronze', 'Silver', 'Gold']) },
  {
    key: 'usfsa_adult_solo_free_dance', label: 'Adult Solo Free Dance (21+ or 50+)', program: 'USFSA', section: 'Adult Track',
    options: withAges(['Juvenile', 'Intermediate', 'Novice', 'Junior', 'Senior']),
  },
  { key: 'usfsa_adult_pairs', label: 'Adult Pairs (21+ or 50+)', program: 'USFSA', section: 'Adult Track', options: withAges(USFS_BRONZE_GOLD_5) },

  // ---------------- USFSA: adaptive track ----------------
  { key: 'usfsa_adaptive_skating_skills', label: 'Adaptive Skating Skills', program: 'USFSA', section: 'Adaptive Track', options: ['Pre-Bronze', 'Bronze', 'Silver', 'Gold'] },
  { key: 'usfsa_adaptive_singles', label: 'Adaptive Singles', program: 'USFSA', section: 'Adaptive Track', options: ['Pre-Bronze', 'Bronze', 'Silver', 'Gold'] },
  {
    key: 'usfsa_skate_united', label: 'Skate United', program: 'USFSA', section: 'Adaptive Track',
    options: [
      { label: 'Skating Skills', options: USFS_STANDARD_8.map((lv) => `${lv} Skating Skills`) },
      { label: 'Singles', options: USFS_STANDARD_8.map((lv) => `${lv} Singles`) },
      { label: 'Pattern Dance', options: USFS_DANCE_8.map((lv) => `${lv} Pattern Dance`) },
      { label: 'Free Dance', options: USFS_BRONZE_GOLD_5.map((lv) => `${lv} Free Dance`) },
      { label: 'Pairs', options: USFS_BRONZE_GOLD_5.map((lv) => `${lv} Pairs`) },
    ],
  },

  // ---------------- Learn to Skate USA ----------------
  { key: 'lts_snowplow_sam', label: 'Snowplow Sam', program: 'LTS', section: 'LTS', options: range(4, (i) => `Snowplow Sam ${i}`) },
  { key: 'lts_basic_skills', label: 'Basic Skills', program: 'LTS', section: 'LTS', options: range(6, (i) => `Basic ${i}`) },
  { key: 'lts_free_skate', label: 'Free Skate', program: 'LTS', section: 'LTS', options: ['Pre-Free Skate', ...range(6, (i) => `Free Skate ${i}`)] },
  { key: 'lts_adult', label: 'Adult', program: 'LTS', section: 'LTS', options: range(6, (i) => `Adult ${i}`) },
  { key: 'lts_hockey', label: 'Hockey', program: 'LTS', section: 'LTS', options: [...range(4, (i) => `Hockey ${i}`), 'Power Skating'] },
  { key: 'lts_dance', label: 'Ice Dance', program: 'LTS', section: 'LTS', options: range(6, (i) => `Dance ${i}`) },
  { key: 'lts_artistry', label: 'Artistry in Motion (AIM)', program: 'LTS', section: 'LTS', options: range(4, (i) => `AIM ${i}`) },
  { key: 'lts_synchro', label: 'Synchronized Skating', program: 'LTS', section: 'LTS', options: range(4, (i) => `Synchro ${i}`) },
  { key: 'lts_pairs', label: 'Pairs', program: 'LTS', section: 'LTS', options: range(4, (i) => `Pairs ${i}`) },
  { key: 'lts_speed', label: 'Speed Skating', program: 'LTS', section: 'LTS', options: range(6, (i) => `Speed Skating ${i}`) },
  {
    key: 'lts_adaptive', label: 'Adaptive Skating', program: 'LTS', section: 'LTS',
    options: [
      { label: 'Adaptive Skating (Skate United) badges', options: range(12, (i) => `Adaptive ${i}`) },
      { label: 'Special Olympics badges', options: range(12, (i) => `Special Olympics Badge ${i}`) },
    ],
  },
];

/** Membership-number text fields (not dropdowns). */
export const NUMBER_KEYS = PROGRAMS.map((p) => p.numberKey);

/** Legacy column whose value now lives in another column (old "USFSA Basic 1-6" was really Learn to Skate Basic). */
export const LEGACY_LEVEL_MOVES = { usfsa_basic: 'lts_basic_skills' };

/** Every students level/number column the UI writes. */
export const LEVEL_KEYS = [...LEVEL_GROUPS.map((g) => g.key), ...NUMBER_KEYS];

/** The lts_* columns (for the schema). */
export const LTS_COLUMNS = LEVEL_KEYS.filter((k) => k.startsWith('lts_'));

/** Flat list of a group's options (optgroups flattened). */
export const flatOptions = (group) =>
  group.options.flatMap((o) => (typeof o === 'string' ? [o] : o.options));

/** Groups for a program, in order, bucketed by section: [{ section, groups }]. */
export const groupsBySection = (program) => {
  const out = [];
  for (const g of LEVEL_GROUPS.filter((x) => x.program === program)) {
    let b = out.find((s) => s.section === g.section);
    if (!b) out.push((b = { section: g.section, groups: [] }));
    b.groups.push(g);
  }
  return out;
};

const PROGRAM_SHORT = { ISI: 'ISI', USFSA: 'USFSA', LTS: 'LTS' };

/**
 * A student's real level summary (replaces the old nonexistent isi_level / usfsa_level fields).
 * Returns [{ program, label, value }] for every non-empty level column (legacy usfsa_basic included).
 */
export const levelEntries = (student) => {
  if (!student) return [];
  const out = [];
  for (const g of LEVEL_GROUPS) {
    const v = student[g.key];
    if (v && String(v).trim()) out.push({ program: g.program, key: g.key, label: g.label, value: String(v).trim() });
  }
  const legacyBasic = student.usfsa_basic && String(student.usfsa_basic).trim();
  if (legacyBasic && !(student.lts_basic_skills && String(student.lts_basic_skills).trim())) {
    out.push({ program: 'LTS', key: 'usfsa_basic', label: 'Basic Skills', value: legacyBasic });
  }
  // Legacy 2.x single-summary columns (kept in the schema for imported data): show only when the program
  // has no structured level yet.
  for (const [key, program] of [['isi_level', 'ISI'], ['usfsa_level', 'USFSA']]) {
    const v = student[key] && String(student[key]).trim();
    if (v && !out.some((e) => e.program === program)) out.push({ program, key, label: 'Level', value: v });
  }
  return out;
};

/** Values joined per program: { ISI: 'Freestyle 3, Figure 2', USFSA: '...', LTS: '...' } (missing = ''). */
const shortLabel = (label) => (label === 'Level' ? '' : label).replace(/^ISI /, '').replace(/\s*\(.*\)\s*$/, '').replace(/ 1-4$/, '').trim();

/** "Freestyle 3" stays as-is; "Bronze" under Skating Skills becomes "Skating Skills: Bronze". */
export const describeLevel = (label, value) => {
  const s = shortLabel(label);
  if (!s) return String(value);
  const first = s.split(' ')[0].replace(/s$/i, '').toLowerCase();
  return String(value).toLowerCase().startsWith(first) ? String(value) : `${s}: ${value}`;
};

export const levelsByProgram = (student) => {
  const res = { ISI: '', USFSA: '', LTS: '' };
  for (const e of levelEntries(student)) {
    const text = describeLevel(e.label, e.value);
    res[e.program] = res[e.program] ? `${res[e.program]}, ${text}` : text;
  }
  return res;
};

/** One-line summary, e.g. "ISI: Freestyle 3 • USFSA: Singles: Bronze". Empty string when no levels. */
export const levelSummary = (student) => {
  const by = levelsByProgram(student);
  return ['ISI', 'USFSA', 'LTS'].filter((p) => by[p]).map((p) => `${PROGRAM_SHORT[p]}: ${by[p]}`).join(' • ');
};

/** Blank student form, with every level column = ''. */
export const blankStudentForm = (clientId = '') => {
  const f = { client_id: clientId, name: '', email: '', birthdate: '', notes: '' };
  for (const k of LEVEL_KEYS) f[k] = '';
  return f;
};
