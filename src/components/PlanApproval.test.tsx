import { render } from 'ink-testing-library';

import { tick } from '../utils/test';
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

  it('calls onAuto when A is pressed', async () => {
    const mockAuto = vi.fn();
    const { stdin } = render(
      <PlanApproval
        planContent="test plan"
        onAuto={mockAuto}
        onSafe={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    stdin.write('a');
    await tick();

    expect(mockAuto).toHaveBeenCalled();
  });

  it('calls onSafe when S is pressed', async () => {
    const mockSafe = vi.fn();
    const { stdin } = render(
      <PlanApproval
        planContent="test plan"
        onAuto={vi.fn()}
        onSafe={mockSafe}
        onCancel={vi.fn()}
      />,
    );

    stdin.write('s');
    await tick();

    expect(mockSafe).toHaveBeenCalled();
  });

  it('calls onCancel when C is pressed', async () => {
    const mockCancel = vi.fn();
    const { stdin } = render(
      <PlanApproval
        planContent="test plan"
        onAuto={vi.fn()}
        onSafe={vi.fn()}
        onCancel={mockCancel}
      />,
    );

    stdin.write('c');
    await tick();

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

    expect(lastFrame()).toContain('[A]');
    expect(lastFrame()).toContain('Auto');
    expect(lastFrame()).toContain('[S]');
    expect(lastFrame()).toContain('Safe');
    expect(lastFrame()).toContain('[C]');
    expect(lastFrame()).toContain('Cancel');
  });
});
