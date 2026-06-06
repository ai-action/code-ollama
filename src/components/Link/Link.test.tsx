import { renderWithTheme } from '@/utils/testing';

import { Link } from './Link';

describe('Link', () => {
  it('renders the href as a terminal hyperlink label by default', () => {
    const { lastFrame } = renderWithTheme(<Link href="https://example.com" />);

    expect(lastFrame()).toContain('https://example.com');
    expect(lastFrame()).toContain('\u001B]8;;https://example.com\u0007');
  });

  it('renders custom children', () => {
    const { lastFrame } = renderWithTheme(
      <Link href="https://example.com">Example</Link>,
    );

    expect(lastFrame()).toContain('Example');
    expect(lastFrame()).toContain('\u001B]8;;https://example.com\u0007');
  });
});
