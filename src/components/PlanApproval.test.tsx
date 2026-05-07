import { render } from 'ink-testing-library';

import { KEY, MODE } from '../constants';
import { test } from '../utils';

const { mockOnChange } = vi.hoisted(() => ({
  mockOnChange: vi.fn<(value: MODE.Name) => void>(),
}));

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
    Select: ({
      options,
      onChange,
    }: {
      options: { label: string; value: MODE.Name }[];
      defaultValue?: MODE.Name;
      onChange?: (value: MODE.Name) => void;
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

    mockOnChange(MODE.NAME.AUTO);

    expect(onModeChange).toHaveBeenCalledWith(MODE.NAME.AUTO);
  });

  it('calls onModeChange with safe when safe is chosen', () => {
    const onModeChange = vi.fn();
    render(
      <PlanApproval planContent="test plan" onModeChange={onModeChange} />,
    );

    mockOnChange(MODE.NAME.SAFE);

    expect(onModeChange).toHaveBeenCalledWith(MODE.NAME.SAFE);
  });

  it('calls onModeChange with plan when plan is chosen', () => {
    const onModeChange = vi.fn();
    render(
      <PlanApproval planContent="test plan" onModeChange={onModeChange} />,
    );

    mockOnChange(MODE.NAME.PLAN);

    expect(onModeChange).toHaveBeenCalledWith(MODE.NAME.PLAN);
  });

  it('calls onModeChange with plan when Escape is pressed', async () => {
    const onModeChange = vi.fn();
    const { stdin } = render(
      <PlanApproval planContent="test plan" onModeChange={onModeChange} />,
    );

    stdin.write(KEY.ESCAPE);
    await test.tick(20);

    expect(onModeChange).toHaveBeenCalledWith(MODE.NAME.PLAN);
  });

  it('ignores non-escape keys', async () => {
    const onModeChange = vi.fn();
    const { stdin } = render(
      <PlanApproval planContent="test plan" onModeChange={onModeChange} />,
    );

    stdin.write(KEY.ENTER);
    await test.tick(20);

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
