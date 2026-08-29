import React from 'react';

type ContactLinkKind = 'email' | 'phone' | 'text';

interface ContactLinkPart {
  kind: ContactLinkKind;
  value: string;
  href?: string;
}

interface ContactLinkTextProps {
  value: string;
}

const CONTACT_PATTERN = /([^\s·,;]+@[^\s·,;]+\.[^\s·,;]+)|((?:\+|00)?\d[\d\s().-]{5,}\d)/gi;

const buildWhatsappHref = (phone: string) => {
  const digits = phone.replace(/\D/g, '').replace(/^00/, '');
  return digits ? `https://wa.me/${digits}` : '';
};

const buildContactLinkParts = (value: string): ContactLinkPart[] => {
  const parts: ContactLinkPart[] = [];
  let cursor = 0;

  for (const match of value.matchAll(CONTACT_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push({ kind: 'text', value: value.slice(cursor, index) });
    }

    const matchedValue = match[0];
    if (match[1]) {
      parts.push({
        kind: 'email',
        value: matchedValue,
        href: `mailto:${matchedValue}`,
      });
    } else {
      const href = buildWhatsappHref(matchedValue);
      parts.push({
        kind: href ? 'phone' : 'text',
        value: matchedValue,
        href: href || undefined,
      });
    }

    cursor = index + matchedValue.length;
  }

  if (cursor < value.length) {
    parts.push({ kind: 'text', value: value.slice(cursor) });
  }

  return parts.length > 0 ? parts : [{ kind: 'text', value }];
};

const ContactLinkText: React.FC<ContactLinkTextProps> = ({ value }) => (
  <>
    {buildContactLinkParts(value).map((part, index) => {
      if (!part.href) {
        return <React.Fragment key={`${part.kind}-${index}`}>{part.value}</React.Fragment>;
      }

      return (
        <a
          key={`${part.kind}-${index}`}
          href={part.href}
          className="text-inherit no-underline transition-colors hover:text-primary active:text-primary focus-visible:text-primary"
          {...(part.kind === 'phone' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {part.value}
        </a>
      );
    })}
  </>
);

export default ContactLinkText;
