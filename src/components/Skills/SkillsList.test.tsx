import { SkillSource } from '@/utils/skills';
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
          {
            name: 'review',
            source: SkillSource.Project,
            content: 'Review code',
            path: '/test/project/.code-ollama/skills/review',
            isDisabled: false,
          },
          {
            name: 'style',
            source: SkillSource.Project,
            content: 'Follow style guide',
            path: '/test/project/.code-ollama/skills/style',
            isDisabled: false,
          },
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
            source: SkillSource.Project,
            description: 'Review staged changes.',
            content: 'Review code',
            path: '/test/project/.code-ollama/skills/review',
            isDisabled: false,
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
        items={[
          {
            name: 'style',
            source: SkillSource.Project,
            content: 'Style guide',
            path: '/test/project/.code-ollama/skills/style',
            isDisabled: false,
          },
        ]}
        label="Project"
      />,
    );

    expect(lastFrame()).toContain('- style');
    expect(lastFrame()).not.toContain('Description');
  });
});
