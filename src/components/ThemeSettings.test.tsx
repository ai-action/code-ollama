import { render } from 'ink-testing-library';

import { THEME } from '../constants';
import { time } from '../utils';

interface MockCodeBlockProps {
  code: string;
  language?: string;
  role: string;
  theme?: unknown;
}

interface MockSelectPromptHintProps {
  message?: string;
  escapeLabel?: string;
}

const { inputHandlers } = vi.hoisted(() => {
  const inputHandlers: ((
    input: string,
    key: {
      ctrl?: boolean;
      escape?: boolean;
      upArrow?: boolean;
      downArrow?: boolean;
      return?: boolean;
    },
  ) => void)[] = [];
  return { inputHandlers };
});

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useInput: (
    handler: (
      input: string,
      key: {
        ctrl?: boolean;
        escape?: boolean;
        upArrow?: boolean;
        downArrow?: boolean;
        return?: boolean;
      },
    ) => void,
  ) => {
    inputHandlers.push(handler);
  },
}));

vi.mock('./CodeBlock', async () => {
  const { Text } = await vi.importActual<typeof import('ink')>('ink');
  return {
    CodeBlock: (props: MockCodeBlockProps) => <Text>{props.code}</Text>,
  };
});

vi.mock('./SelectPrompt', async () => {
  const { Text } = await vi.importActual<typeof import('ink')>('ink');
  return {
    SelectPromptHint: ({ message, escapeLabel }: MockSelectPromptHintProps) => (
      <Text>
        {message} {escapeLabel}
      </Text>
    ),
  };
});

import { ThemeSettings } from './ThemeSettings';

describe('ThemeSettings', () => {
  beforeEach(() => {
    inputHandlers.length = 0;
  });

  it('renders the current theme label and description', () => {
    const { lastFrame } = render(
      <ThemeSettings
        currentTheme="github-dark"
        onClose={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('GitHub Dark');
    expect(lastFrame()).toContain('Dark GitHub palette');
  });

  it('renders all theme options in the list', () => {
    const { lastFrame } = render(
      <ThemeSettings
        currentTheme="github-dark"
        onClose={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    for (const theme of THEME.LIST) {
      expect(lastFrame()).toContain(theme.label);
    }
  });

  it('calls onPreview with initial theme on mount', () => {
    const onPreview = vi.fn();
    render(
      <ThemeSettings
        currentTheme="nord"
        onClose={vi.fn()}
        onPreview={onPreview}
        onSave={vi.fn()}
      />,
    );

    expect(onPreview).toHaveBeenCalledWith('nord');
  });

  it('falls back to index 0 when currentTheme is not found', () => {
    const onPreview = vi.fn();
    render(
      <ThemeSettings
        currentTheme={'unknown-theme' as never}
        onClose={vi.fn()}
        onPreview={onPreview}
        onSave={vi.fn()}
      />,
    );

    expect(onPreview).toHaveBeenCalledWith(THEME.LIST[0].id);
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();
    render(
      <ThemeSettings
        currentTheme="github-dark"
        onClose={onClose}
        onPreview={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const handler = inputHandlers.at(-1);
    handler?.('', { escape: true });
    await time.tick();

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when Ctrl+C is pressed', async () => {
    const onClose = vi.fn();
    render(
      <ThemeSettings
        currentTheme="github-dark"
        onClose={onClose}
        onPreview={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const handler = inputHandlers.at(-1);
    handler?.('c', { ctrl: true });
    await time.tick();

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onSave with selected theme when Enter is pressed', async () => {
    const onSave = vi.fn();
    render(
      <ThemeSettings
        currentTheme="nord"
        onClose={vi.fn()}
        onPreview={vi.fn()}
        onSave={onSave}
      />,
    );

    const handler = inputHandlers.at(-1);
    handler?.('', { return: true });
    await time.tick();

    expect(onSave).toHaveBeenCalledWith('nord');
  });

  it('moves selection down with down arrow and calls onPreview', async () => {
    const onPreview = vi.fn();
    render(
      <ThemeSettings
        currentTheme="github-dark"
        onClose={vi.fn()}
        onPreview={onPreview}
        onSave={vi.fn()}
      />,
    );

    const handler = inputHandlers.at(-1);
    handler?.('', { downArrow: true });
    await time.tick(10);

    const nextThemeId = THEME.LIST[2]?.id ?? THEME.LIST[0].id;
    expect(onPreview).toHaveBeenCalledWith(nextThemeId);
  });

  it('moves selection up with up arrow', async () => {
    const onPreview = vi.fn();
    render(
      <ThemeSettings
        currentTheme="github-dark"
        onClose={vi.fn()}
        onPreview={onPreview}
        onSave={vi.fn()}
      />,
    );

    const handler = inputHandlers.at(-1);
    handler?.('', { upArrow: true });
    await time.tick(10);

    expect(onPreview).toHaveBeenCalledWith(THEME.LIST[0].id);
  });

  it('wraps down arrow from last to first', async () => {
    const lastThemeId = THEME.LIST[THEME.LIST.length - 1].id;
    const onPreview = vi.fn();
    render(
      <ThemeSettings
        currentTheme={lastThemeId}
        onClose={vi.fn()}
        onPreview={onPreview}
        onSave={vi.fn()}
      />,
    );

    const handler = inputHandlers.at(-1);
    handler?.('', { downArrow: true });
    await time.tick(10);

    expect(onPreview).toHaveBeenCalledWith(THEME.LIST[0].id);
  });

  it('wraps up arrow from first to last', async () => {
    const onPreview = vi.fn();
    render(
      <ThemeSettings
        currentTheme="github-light"
        onClose={vi.fn()}
        onPreview={onPreview}
        onSave={vi.fn()}
      />,
    );

    const handler = inputHandlers.at(-1);
    handler?.('', { upArrow: true });
    await time.tick(10);

    expect(onPreview).toHaveBeenCalledWith(
      THEME.LIST[THEME.LIST.length - 1].id,
    );
  });

  it('ignores unrecognized key input', async () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(
      <ThemeSettings
        currentTheme="github-dark"
        onClose={onClose}
        onPreview={vi.fn()}
        onSave={onSave}
      />,
    );

    const handler = inputHandlers.at(-1);
    handler?.('a', {});
    await time.tick();

    expect(onClose).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('renders the hint with correct labels', () => {
    const { lastFrame } = render(
      <ThemeSettings
        currentTheme="github-dark"
        onClose={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Preview theme');
    expect(lastFrame()).toContain('cancel and restore');
  });

  it('renders the code preview block', () => {
    const { lastFrame } = render(
      <ThemeSettings
        currentTheme="github-dark"
        onClose={vi.fn()}
        onPreview={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain("const theme = 'preview';");
  });
});
