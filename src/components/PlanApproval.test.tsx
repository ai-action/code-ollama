import { render } from 'ink-testing-library';

import { KEY, MODE } from '../constants';
import type { Mode } from '../types';
import { time } from '../utils';

const { mockOnChange } = vi.hoisted(() => ({
  mockOnChange: vi.fn<(value: Mode) => void>(),
}));

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
    Select: ({
      options,
      onChange,
    }: {
      options: { label: string; value: string }[];
      defaultValue?: string;
      onChange?: (value: string) => void;
    }) => {
      mockOnChange.mockImplementation((value) => onChange?.(value));
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

import { PlanApproval } from './PlanApproval';

describe('PlanApproval', () => {
  it('renders plan content', () => {
    const { lastFrame } = render(
      <PlanApproval
        planContent="- [ ] write_file('test.txt') - Create test file"
        onModeChange={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Plan Generated');
    expect(lastFrame()).toContain('write_file');
  });

  it('calls onModeChange with auto when auto is chosen', () => {
    const onModeChange = vi.fn();
    render(
      <PlanApproval planContent="test plan" onModeChange={onModeChange} />,
    );

    mockOnChange(MODE.AUTO);

    expect(onModeChange).toHaveBeenCalledWith(MODE.AUTO);
  });

  it('calls onModeChange with safe when safe is chosen', () => {
    const onModeChange = vi.fn();
    render(
      <PlanApproval planContent="test plan" onModeChange={onModeChange} />,
    );

    mockOnChange(MODE.SAFE);

    expect(onModeChange).toHaveBeenCalledWith(MODE.SAFE);
  });

  it('calls onModeChange with plan when plan is chosen', () => {
    const onModeChange = vi.fn();
    render(
      <PlanApproval planContent="test plan" onModeChange={onModeChange} />,
    );

    mockOnChange(MODE.PLAN);

    expect(onModeChange).toHaveBeenCalledWith(MODE.PLAN);
  });

  it('calls onModeChange with plan when Escape is pressed', async () => {
    const onModeChange = vi.fn();
    const { stdin } = render(
      <PlanApproval planContent="test plan" onModeChange={onModeChange} />,
    );

    stdin.write(KEY.ESCAPE);
    await time.tick(20);

    expect(onModeChange).toHaveBeenCalledWith(MODE.PLAN);
  });

  it('ignores non-escape keys', async () => {
    const onModeChange = vi.fn();
    const { stdin } = render(
      <PlanApproval planContent="test plan" onModeChange={onModeChange} />,
    );

    stdin.write(KEY.ENTER);
    await time.tick(20);

    expect(onModeChange).not.toHaveBeenCalled();
  });

  it('shows all three options', () => {
    const { lastFrame } = render(
      <PlanApproval planContent="test plan" onModeChange={vi.fn()} />,
    );

    expect(lastFrame()).toContain('Auto');
    expect(lastFrame()).toContain('Safe');
    expect(lastFrame()).toContain('Cancel');
  });
});
