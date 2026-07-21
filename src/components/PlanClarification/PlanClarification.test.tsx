import { KEY } from '@/constants';
import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

const { selectOption } = vi.hoisted(() => ({
  selectOption: vi.fn<(value: string) => void>(),
}));

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
    Select: ({
      options,
      onChange,
    }: {
      options: { label: string; value: string }[];
      onChange?: (value: string) => void;
    }) => {
      selectOption.mockImplementation((value) => onChange?.(value));
      return (
        <>
          {options.map(({ value, label }) => (
            <Text key={value}>{label}</Text>
          ))}
        </>
      );
    },
  };
});

import { PlanClarification } from './PlanClarification';

describe('PlanClarification', () => {
  beforeEach(() => {
    selectOption.mockReset();
  });

  const question = {
    prompt: 'Which behavior should be used?',
    options: ['Safe', 'Fast'],
  };

  it('renders the plan and selectable answers', () => {
    const { lastFrame } = renderWithTheme(
      <PlanClarification
        planContent="## Plan Needs Input\n\nWhich behavior should be used?"
        question={question}
        onAnswer={vi.fn()}
        onCustom={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Plan Clarification - Choose an answer:');
    expect(lastFrame()).toContain('Safe');
    expect(lastFrame()).toContain('Fast');
    expect(lastFrame()).toContain('Type a custom response');
  });

  it('returns the selected answer', () => {
    const onAnswer = vi.fn();
    renderWithTheme(
      <PlanClarification
        planContent="Plan"
        question={question}
        onAnswer={onAnswer}
        onCustom={vi.fn()}
      />,
    );

    selectOption('1');

    expect(onAnswer).toHaveBeenCalledWith('Fast');
  });

  it('enables custom input from the custom option or Escape', async () => {
    const onCustom = vi.fn();
    const { stdin } = renderWithTheme(
      <PlanClarification
        planContent="Plan"
        question={question}
        onAnswer={vi.fn()}
        onCustom={onCustom}
      />,
    );

    selectOption('custom');
    stdin.write(KEY.ESCAPE);
    await time.tick(20);

    expect(onCustom).toHaveBeenCalledTimes(2);
  });
});
