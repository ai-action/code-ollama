declare module 'marked-terminal' {
  import { Renderer } from 'marked';

  interface TerminalRendererOptions {
    code?: string;
    blockquote?: string;
    table?: string;
    paragraph?: string;
    text?: string;
    heading?: string;
    firstHeading?: string;
    hr?: string;
    link?: string;
    linkText?: string;
    list?: string;
    listitem?: string;
    em?: string;
    strong?: string;
    image?: string;
    showSectionPrefix?: boolean;
    theme?:
      | 'base16'
      | 'cli'
      | 'default'
      | 'doom'
      | 'dracula'
      | 'generic'
      | 'gitHub'
      | 'nord'
      | 'ocean'
      | 'print'
      | 'solarized'
      | 'witchhazel';
  }

  class TerminalRenderer extends Renderer {
    constructor(options?: TerminalRendererOptions);
  }

  export = TerminalRenderer;
}
