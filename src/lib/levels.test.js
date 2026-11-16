import { describe, it, expect } from 'vitest';
import {
  LEVEL_GROUPS, LEVEL_KEYS, LTS_COLUMNS, PROGRAMS, NUMBER_KEYS, flatOptions, groupsBySection,
  levelEntries, levelSummary, levelsByProgram, describeLevel, blankStudentForm,
} from './levels.js';

const EXPECTED_COUNTS = {
  isi_freestyle: 19, isi_open_freestyle: 4, isi_figures: 10, isi_couples: 10, isi_pairs: 10, isi_icedance: 10,
  isi_international_dance: 11, isi_freedance_partnered: 10, isi_solo_freedance: 5, isi_synchro: 4, isi_special_skater: 14,
  usfsa_aspire: 4, usfsa_skating_skills: 8, usfsa_singles: 8, usfsa_pattern_dance: 32, usfsa_free_dance: 10, usfsa_pairs: 5,
  usfsa_adult_skating_skills: 16, usfsa_adult_singles: 16, usfsa_adult_pattern_dance: 16, usfsa_adult_free_dance: 8,
  usfsa_adult_solo_free_dance: 10, usfsa_adult_pairs: 10,
  usfsa_adaptive_skating_skills: 4, usfsa_adaptive_singles: 4, usfsa_skate_united: 34,
  lts_snowplow_sam: 4, lts_basic_skills: 6, lts_free_skate: 7, lts_adult: 6, lts_hockey: 5, lts_dance: 6,
  lts_artistry: 4, lts_synchro: 4, lts_pairs: 4, lts_speed: 6, lts_adaptive: 24,
};

describe('levels data', () => {
  it('every key is unique and a valid column name for its program', () => {
    expect(new Set(LEVEL_KEYS).size).toBe(LEVEL_KEYS.length);
    const prefix = { ISI: 'isi_', USFSA: 'usfsa_', LTS: 'lts_' };
    for (const g of LEVEL_GROUPS) {
      expect(g.key).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(g.key.startsWith(prefix[g.program])).toBe(true);
      expect(g.label.trim()).not.toBe('');
      expect(g.section).toBeTruthy();
    }
  });

  it('every option is a non-empty trimmed string, unique within its list', () => {
    for (const g of LEVEL_GROUPS) {
      const opts = flatOptions(g);
      expect(opts.length).toBeGreaterThan(0);
      for (const o of opts) {
        expect(typeof o).toBe('string');
        expect(o.trim()).toBe(o);
        expect(o).not.toBe('');
      }
      expect(new Set(opts).size, g.key).toBe(opts.length);
      for (const og of g.options.filter((o) => typeof o !== 'string')) {
        expect(og.label.trim()).not.toBe('');
        expect(og.options.length).toBeGreaterThan(0);
      }
    }
  });

  it('option counts match the verified official structures', () => {
    const counts = Object.fromEntries(LEVEL_GROUPS.map((g) => [g.key, flatOptions(g).length]));
    expect(counts).toEqual(EXPECTED_COUNTS);
  });

  it('exact Learn to Skate USA column list and key official names', () => {
    expect(LTS_COLUMNS).toEqual([
      'lts_snowplow_sam', 'lts_basic_skills', 'lts_free_skate', 'lts_adult', 'lts_hockey', 'lts_dance',
      'lts_artistry', 'lts_synchro', 'lts_pairs', 'lts_speed', 'lts_adaptive', 'lts_number',
    ]);
    const by = Object.fromEntries(LEVEL_GROUPS.map((g) => [g.key, flatOptions(g)]));
    expect(by.lts_basic_skills).toEqual(['Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6']);
    expect(by.lts_free_skate[0]).toBe('Pre-Free Skate');
    expect(by.usfsa_skating_skills).toEqual(['Pre-Preliminary', 'Preliminary', 'Pre-Bronze', 'Bronze', 'Pre-Silver', 'Silver', 'Pre-Gold', 'Gold']);
    expect(by.isi_freestyle.slice(0, 9)).toEqual(['Tot 1', 'Tot 2', 'Tot 3', 'Tot 4', 'Pre-Alpha', 'Alpha', 'Beta', 'Gamma', 'Delta']);
    expect(by.isi_freestyle.at(-1)).toBe('Freestyle 10');
  });

  it('includes every legacy schema column (except moved usfsa_basic) plus membership numbers', () => {
    const legacy = ['isi_freestyle', 'isi_open_freestyle', 'isi_figures', 'isi_couples', 'isi_pairs', 'isi_icedance',
      'isi_international_dance', 'isi_freedance_partnered', 'isi_solo_freedance', 'isi_synchro', 'isi_special_skater',
      'isi_number', 'usfsa_aspire', 'usfsa_skating_skills', 'usfsa_singles', 'usfsa_pattern_dance', 'usfsa_free_dance',
      'usfsa_pairs', 'usfsa_number', 'usfsa_adult_skating_skills', 'usfsa_adult_singles', 'usfsa_adult_pattern_dance',
      'usfsa_adult_free_dance', 'usfsa_adult_solo_free_dance', 'usfsa_adult_pairs', 'usfsa_adaptive_skating_skills',
      'usfsa_adaptive_singles', 'usfsa_skate_united'];
    for (const k of legacy) expect(LEVEL_KEYS).toContain(k);
    expect(NUMBER_KEYS).toEqual(['isi_number', 'usfsa_number', 'lts_number']);
    expect(PROGRAMS.map((p) => p.id)).toEqual(['ISI', 'USFSA', 'LTS']);
  });

  it('groupsBySection covers every group exactly once', () => {
    const all = PROGRAMS.flatMap((p) => groupsBySection(p.id).flatMap((s) => s.groups.map((g) => g.key)));
    expect(all.sort()).toEqual(LEVEL_GROUPS.map((g) => g.key).sort());
    expect(groupsBySection('USFSA').map((s) => s.section)).toEqual(['Standard Track', 'Adult Track', 'Adaptive Track']);
  });
});

describe('level summary', () => {
  it('summarizes real level columns (not the old nonexistent isi_level/usfsa_level)', () => {
    const s = { isi_freestyle: 'Freestyle 3', isi_open_freestyle: 'Bronze', usfsa_singles: 'Bronze', lts_basic_skills: 'Basic 4', isi_level: 'old value' };
    expect(levelsByProgram(s)).toEqual({ ISI: 'Freestyle 3, Open Freestyle: Bronze', USFSA: 'Singles: Bronze', LTS: 'Basic 4' });
    expect(levelSummary(s)).toBe('ISI: Freestyle 3, Open Freestyle: Bronze • USFSA: Singles: Bronze • LTS: Basic 4');
    expect(levelSummary({})).toBe('');
    expect(levelSummary(null)).toBe('');
  });
  it('shows legacy usfsa_basic as Learn to Skate Basic when lts_basic_skills is empty', () => {
    expect(levelEntries({ usfsa_basic: 'Basic 2' })).toEqual([{ program: 'LTS', key: 'usfsa_basic', label: 'Basic Skills', value: 'Basic 2' }]);
    expect(levelEntries({ usfsa_basic: 'Basic 2', lts_basic_skills: 'Basic 5' }).map((e) => e.value)).toEqual(['Basic 5']);
  });
  it('describeLevel avoids redundant labels', () => {
    expect(describeLevel('ISI Figures', 'Figure 2')).toBe('Figure 2');
    expect(describeLevel('Adult Skating Skills (21+ or 50+)', 'Bronze (21+)')).toBe('Adult Skating Skills: Bronze (21+)');
    expect(describeLevel('Aspire 1-4', 'Aspire 2')).toBe('Aspire 2');
  });
  it('legacy isi_level / usfsa_level shown only when no structured level exists for that program', () => {
    expect(levelSummary({ isi_level: 'Gamma', usfsa_level: 'Preliminary' })).toBe('ISI: Gamma • USFSA: Preliminary');
    expect(levelSummary({ isi_level: 'Gamma', isi_freestyle: 'Delta' })).toBe('ISI: Freestyle: Delta');
  });
  it('blank form has every level key', () => {
    const f = blankStudentForm(7);
    expect(f.client_id).toBe(7);
    for (const k of LEVEL_KEYS) expect(f[k]).toBe('');
  });
});
