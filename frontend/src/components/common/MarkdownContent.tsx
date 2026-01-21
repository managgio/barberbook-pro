import React from 'react';
import { cn } from '@/lib/utils';

type MarkdownContentProps = {
  markdown: string;
  className?: string;
};

const renderInline = (text: string) => {
  const pattern = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      nodes.push(
        <strong key={`b-${index}`} className="text-foreground font-semibold">
          {match[2]}
        </strong>,
      );
    } else if (match[3] && match[4]) {
      nodes.push(
        <a
          key={`l-${index}`}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-4"
        >
          {match[3]}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
    index += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
};

const parseBlocks = (markdown: string) => {
  const lines = markdown.split('\n');
  const blocks: React.ReactNode[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let keyIndex = 0;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    const text = paragraph.join(' ').trim();
    blocks.push(
      <p key={`p-${keyIndex}`} className="text-sm leading-6 text-muted-foreground">
        {renderInline(text)}
      </p>,
    );
    paragraph = [];
    keyIndex += 1;
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`ul-${keyIndex}`} className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
        {listItems.map((item, itemIndex) => (
          <li key={`li-${keyIndex}-${itemIndex}`}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
    keyIndex += 1;
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushParagraph();
      listItems.push(trimmed.slice(2).trim());
      return;
    }
    flushList();
    paragraph.push(trimmed);
  });

  flushParagraph();
  flushList();

  return blocks;
};

const MarkdownContent: React.FC<MarkdownContentProps> = ({ markdown, className }) => (
  <div className={cn('space-y-3', className)}>{parseBlocks(markdown)}</div>
);

export default MarkdownContent;
