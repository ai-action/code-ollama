declare module 'marked-terminal' {
  import { MarkedExtension, Renderer } from 'marked';

  export interface TerminalRendererOptions {
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

  export default class TerminalRenderer extends Renderer {
    constructor(options?: TerminalRendererOptions);
  }

  export function markedTerminal(
    options?: TerminalRendererOptions,
    highlightOptions?: object,
  ): MarkedExtension;
}
