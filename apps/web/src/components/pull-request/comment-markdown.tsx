import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: ComponentProps<typeof Markdown>["components"] = {
  a: ({ children, href }) => (
    <a
      className="text-foreground underline underline-offset-2 hover:text-primary"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-border border-l-2 pl-2.5 text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
        {children}
      </code>
    ),
  h1: ({ children }) => <p className="font-semibold">{children}</p>,
  h2: ({ children }) => <p className="font-semibold">{children}</p>,
  h3: ({ children }) => <p className="font-medium">{children}</p>,
  h4: ({ children }) => <p className="font-medium">{children}</p>,
  li: ({ children }) => <li className="my-0.5">{children}</li>,
  ol: ({ children }) => (
    <ol className="list-decimal pl-4 marker:text-muted-foreground">
      {children}
    </ol>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-md bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed">
      {children}
    </pre>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-4 marker:text-muted-foreground">{children}</ul>
  ),
};

interface CommentMarkdownProps {
  text: string;
}

export function CommentMarkdown({ text }: CommentMarkdownProps) {
  return (
    <div className="flex flex-col gap-1.5 break-words text-foreground/90 text-xs leading-relaxed">
      <Markdown components={components} remarkPlugins={[remarkGfm]}>
        {text}
      </Markdown>
    </div>
  );
}
