import { renderWithTheme } from '@/utils/testing';

import { SkillsList } from './SkillsList';

describe('SkillsList', () => {
  it('renders nothing when items is empty', () => {
    const { lastFrame } = renderWithTheme(
      <SkillsList items={[]} label="Project" />,
    );

    expect(lastFrame()).toBe('');
  });

  it('renders the label and skill names', () => {
    const { lastFrame } = renderWithTheme(
      <SkillsList
        items={[
          { name: 'review', source: 'project', content: 'Review code' },
          { name: 'style', source: 'project', content: 'Follow style guide' },
        ]}
        label="Project"
      />,
    );

    expect(lastFrame()).toContain('Project:');
    expect(lastFrame()).toContain('- review');
    expect(lastFrame()).toContain('- style');
  });

  it('renders a description when present', () => {
    const { lastFrame } = renderWithTheme(
      <SkillsList
        items={[
          {
            name: 'review',
            source: 'project',
            description: 'Review staged changes.',
            content: 'Review code',
          },
        ]}
        label="Project"
      />,
    );

    expect(lastFrame()).toContain('Review staged changes.');
  });

  it('omits description when not present', () => {
    const { lastFrame } = renderWithTheme(
      <SkillsList
        items={[{ name: 'style', source: 'project', content: 'Style guide' }]}
        label="Project"
      />,
    );

    expect(lastFrame()).toContain('- style');
    expect(lastFrame()).not.toContain('Description');
  });
});
