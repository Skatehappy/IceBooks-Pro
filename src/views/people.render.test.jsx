import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { makeStyles } from '../ui/styles.js';
import { LEVEL_GROUPS, flatOptions } from '../lib/levels.js';

const app = {
  supabase: {}, isCoach: true, profile: { id: 'u1', role: 'coach' }, reload: async () => {}, toast: () => {},
  nav: () => {}, isMobile: false, styles: makeStyles(false),
  data: {
    clients: [{ id: 1, name: 'Jane Smith', email: 'jane@x.com', phone: '555' }],
    students: [{ id: 9, client_id: 1, name: 'Emma', isi_freestyle: 'Freestyle 3', usfsa_singles: 'Bronze', lts_basic_skills: 'Basic 4', isi_figures: 'Figures 2' }],
  },
};
vi.mock('../context.jsx', () => ({ useApp: () => app }));
vi.mock('../lib/supabase.js', () => ({ supabase: {} }));

const { default: StudentModal } = await import('../modals/StudentModal.jsx');
const { default: ClientModal } = await import('../modals/ClientModal.jsx');
const { default: ClientsView } = await import('./ClientsView.jsx');
const { default: StudentsView } = await import('./StudentsView.jsx');
const { default: MyStudentsView } = await import('./MyStudentsView.jsx');

describe('people UI renders', () => {
  it('StudentModal renders every level dropdown under the three program headings', () => {
    const html = renderToString(<StudentModal student={app.data.students[0]} onClose={() => {}} />);
    for (const h of ['ISI Skill Levels', 'U.S. Figure Skating (USFSA)', 'Learn to Skate USA', 'Adult Track', 'Adaptive Track']) expect(html).toContain(h);
    expect((html.match(/<select/g) || []).length).toBe(LEVEL_GROUPS.length + 1); // + parent/client select
    const optionCount = (html.match(/<option/g) || []).length;
    const expected = LEVEL_GROUPS.reduce((n, g) => n + flatOptions(g).length + 1, 0) + 2 /* parent */ + 1 /* legacy 'Figures 2' */;
    expect(optionCount).toBe(expected);
    expect(html).toContain('Figures 2 (previous value)');
    expect(html).toContain('<optgroup label="Special Olympics badges">');
  });
  it('ClientModal (new) shows second parent and student sections', () => {
    const html = renderToString(<ClientModal onClose={() => {}} />);
    expect(html).toContain('Second Parent/Guardian (Optional)');
    expect(html).toContain('Child/Student Name');
    expect(html).not.toContain('>Delete<');
  });
  it('ClientsView shows template/import buttons, rows and Create invoice', () => {
    const html = renderToString(<ClientsView />);
    expect(html).toContain('Download Template');
    expect(html).toContain('Import');
    expect(html).toContain('Jane Smith');
    expect(html).toContain('Create invoice');
  });
  it('StudentsView and MyStudentsView show real level summaries', () => {
    const html = renderToString(<StudentsView />);
    expect(html).toContain('Freestyle 3');
    expect(html).toContain('Singles: Bronze');
    expect(html).toContain('Basic 4');
    const mine = renderToString(<MyStudentsView />);
    expect(mine).toContain('ISI: Freestyle 3');
  });
});
