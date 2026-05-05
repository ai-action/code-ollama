import { render } from 'ink-testing-library';

import { KEY } from '../constants';
import { tick } from '../utils/test';

const { mockOnChange } = vi.hoisted(() => ({
  mockOnChange: vi.fn<(value: 'auto' | 'safe' | 'cancel') => void>(),
}));

vi.mock('@inkjs/ui', async () => {
  const { Text } = await import('ink');
  return {
    Select: ({
      options,
      onChange,
    }: {
      options: { label: string; value: 'auto' | 'safe' | 'cancel' }[];
      defaultValue?: 'auto' | 'safe' | 'cancel';
      onChange?: (value: 'auto' | 'safe' | 'cancel') => void;
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
        onAuto={vi.fn()}
        onSafe={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain('Plan Generated');
    expect(lastFrame()).toContain('write_file');
  });

  it('calls onAuto when auto is chosen', () => {
    const mockAuto = vi.fn();
    render(
      <PlanApproval
        planContent="test plan"
        onAuto={mockAuto}
        onSafe={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    mockOnChange('auto');

    expect(mockAuto).toHaveBeenCalled();
  });

  it('calls onSafe when safe is chosen', () => {
    const mockSafe = vi.fn();
    render(
      <PlanApproval
        planContent="test plan"
        onAuto={vi.fn()}
        onSafe={mockSafe}
        onCancel={vi.fn()}
      />,
    );

    mockOnChange('safe');

    expect(mockSafe).toHaveBeenCalled();
  });

  it('calls onCancel when cancel is chosen', () => {
    const mockCancel = vi.fn();
    render(
      <PlanApproval
        planContent="test plan"
        onAuto={vi.fn()}
        onSafe={vi.fn()}
        onCancel={mockCancel}
      />,
    );

    mockOnChange('cancel');

    expect(mockCancel).toHaveBeenCalled();
  });

  it('calls onCancel when Escape is pressed', async () => {
    const mockCancel = vi.fn();
    const { stdin } = render(
      <PlanApproval
        planContent="test plan"
        onAuto={vi.fn()}
        onSafe={vi.fn()}
        onCancel={mockCancel}
      />,
    );

    stdin.write(KEY.ESCAPE);
    await tick(50);

    expect(mockCancel).toHaveBeenCalled();
  });

  it('shows all three options', () => {
    const { lastFrame } = render(
      <PlanApproval
        planContent="test plan"
        onAuto={vi.fn()}
        onSafe={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Auto');
    expect(lastFrame()).toContain('Safe');
    expect(lastFrame()).toContain('Cancel');
  });
});
