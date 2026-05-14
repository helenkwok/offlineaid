/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import React, { Fragment } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';

import { type AppTheme, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type MarkdownMessageProps = {
  content: string;
};

type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'emphasis'; children: InlineNode[] }
  | { type: 'inlineCode'; text: string }
  | { type: 'link'; href: string; children: InlineNode[] }
  | { type: 'sourceRef'; text: string };

type BlockNode =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'unorderedList'; items: string[] }
  | { type: 'orderedList'; items: string[] }
  | { type: 'blockquote'; text: string }
  | { type: 'codeBlock'; text: string };

type InlineMatch =
  | { type: 'link'; index: number; raw: string; text: string; href: string }
  | { type: 'strong'; index: number; raw: string; text: string }
  | { type: 'emphasis'; index: number; raw: string; text: string }
  | { type: 'inlineCode'; index: number; raw: string; text: string }
  | { type: 'sourceRef'; index: number; raw: string; text: string };

const BLOCK_GAP = 10;
const LINK_PATTERN = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/;
const INLINE_CODE_PATTERN = /`([^`\n]+)`/;
const STRONG_PATTERN = /\*\*([\s\S]+?)\*\*|__([\s\S]+?)__/;
const EMPHASIS_PATTERN = /\*([^*\n]+)\*|_([^_\n]+)_/;
const SOURCE_REF_PATTERN = /\[\d+\]|\[Source: [^\]\n]+\]/;

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const theme = useTheme();
  const styles = createStyles(theme);
  const blocks = parseMarkdown(content);

  async function openMarkdownLink(url: string) {
    if (Platform.OS === 'web') {
      await Linking.openURL(url);
      return;
    }

    await openBrowserAsync(url, {
      presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
    });
  }

  return (
    <View style={styles.container}>
      {blocks.map((block, index) => {
        const key = `block-${index}`;

        if (block.type === 'heading') {
          return (
            <Text key={key} style={[styles.paragraph, styles.heading, headingStyle(block.level)]}>
              {renderInlineNodes(parseInline(block.text), key, styles, openMarkdownLink)}
            </Text>
          );
        }

        if (block.type === 'unorderedList' || block.type === 'orderedList') {
          return (
            <View key={key} style={styles.list}>
              {block.items.map((item, itemIndex) => (
                <View key={`${key}-item-${itemIndex}`} style={styles.listRow}>
                  <Text style={styles.listMarker}>
                    {block.type === 'orderedList' ? `${itemIndex + 1}.` : '•'}
                  </Text>
                  <Text style={[styles.paragraph, styles.listText]}>
                    {renderInlineNodes(parseInline(item), `${key}-item-${itemIndex}`, styles, openMarkdownLink)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        if (block.type === 'blockquote') {
          return (
            <View key={key} style={styles.blockquote}>
              <Text style={[styles.paragraph, styles.blockquoteText]}>
                {renderInlineNodes(parseInline(block.text), key, styles, openMarkdownLink)}
              </Text>
            </View>
          );
        }

        if (block.type === 'codeBlock') {
          return (
            <View key={key} style={styles.codeBlock}>
              <Text style={styles.codeBlockText}>{block.text}</Text>
            </View>
          );
        }

        return (
          <Text key={key} style={styles.paragraph}>
            {renderInlineNodes(parseInline(block.text), key, styles, openMarkdownLink)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInlineNodes(
  nodes: InlineNode[],
  keyPrefix: string,
  styles: ReturnType<typeof createStyles>,
  openMarkdownLink: (url: string) => Promise<void>
): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    if (node.type === 'text') {
      return <Fragment key={key}>{node.text}</Fragment>;
    }

    if (node.type === 'inlineCode') {
      return (
        <Text key={key} style={styles.inlineCode}>
          {node.text}
        </Text>
      );
    }

    if (node.type === 'strong') {
      return (
        <Text key={key} style={styles.strong}>
          {renderInlineNodes(node.children, key, styles, openMarkdownLink)}
        </Text>
      );
    }

    if (node.type === 'emphasis') {
      return (
        <Text key={key} style={styles.emphasis}>
          {renderInlineNodes(node.children, key, styles, openMarkdownLink)}
        </Text>
      );
    }

    if (node.type === 'sourceRef') {
      return (
        <Text key={key} style={styles.sourceRef}>
          {node.text}
        </Text>
      );
    }

    return (
      <Text
        key={key}
        style={styles.link}
        suppressHighlighting
        onPress={() => {
          void openMarkdownLink(node.href);
        }}>
        {renderInlineNodes(node.children, key, styles, openMarkdownLink)}
      </Text>
    );
  });
}

function parseMarkdown(markdown: string): BlockNode[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: BlockNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith('```')) {
      index += 1;
      const codeLines: string[] = [];

      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({ type: 'codeBlock', text: codeLines.join('\n') });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }

      blocks.push({ type: 'blockquote', text: quoteLines.join('\n') });
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      const items: string[] = [];

      while (index < lines.length) {
        const match = lines[index].match(/^\s*[-*+]\s+(.*)$/);
        if (!match) {
          break;
        }
        items.push(match[1]);
        index += 1;
      }

      blocks.push({ type: 'unorderedList', items });
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (orderedMatch) {
      const items: string[] = [];

      while (index < lines.length) {
        const match = lines[index].match(/^\s*\d+\.\s+(.*)$/);
        if (!match) {
          break;
        }
        items.push(match[1]);
        index += 1;
      }

      blocks.push({ type: 'orderedList', items });
      continue;
    }

    const paragraphLines: string[] = [];

    while (index < lines.length) {
      const nextLine = lines[index];
      const nextTrimmed = nextLine.trim();

      if (
        !nextTrimmed ||
        nextTrimmed.startsWith('```') ||
        /^\s*>\s?/.test(nextLine) ||
        /^\s*[-*+]\s+/.test(nextLine) ||
        /^\s*\d+\.\s+/.test(nextLine) ||
        /^(#{1,6})\s+/.test(nextLine)
      ) {
        break;
      }

      paragraphLines.push(nextLine);
      index += 1;
    }

    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') });
  }

  return blocks.length > 0 ? blocks : [{ type: 'paragraph', text: markdown }];
}

function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const next = findNextInlineMatch(remaining);

    if (!next) {
      nodes.push({ type: 'text', text: remaining });
      break;
    }

    if (next.index > 0) {
      nodes.push({ type: 'text', text: remaining.slice(0, next.index) });
    }

    if (next.type === 'link') {
      nodes.push({
        type: 'link',
        href: next.href,
        children: parseInline(next.text),
      });
    } else if (next.type === 'strong') {
      nodes.push({
        type: 'strong',
        children: parseInline(next.text),
      });
    } else if (next.type === 'emphasis') {
      nodes.push({
        type: 'emphasis',
        children: parseInline(next.text),
      });
    } else if (next.type === 'sourceRef') {
      nodes.push({ type: 'sourceRef', text: next.text });
    } else {
      nodes.push({ type: 'inlineCode', text: next.text });
    }

    remaining = remaining.slice(next.index + next.raw.length);
  }

  return nodes;
}

function findNextInlineMatch(text: string): InlineMatch | null {
  const candidates: InlineMatch[] = [];

  const linkMatch = LINK_PATTERN.exec(text);
  if (linkMatch && linkMatch.index !== undefined) {
    candidates.push({
      type: 'link',
      index: linkMatch.index,
      raw: linkMatch[0],
      text: linkMatch[1],
      href: linkMatch[2],
    });
  }

  const inlineCodeMatch = INLINE_CODE_PATTERN.exec(text);
  if (inlineCodeMatch && inlineCodeMatch.index !== undefined) {
    candidates.push({
      type: 'inlineCode',
      index: inlineCodeMatch.index,
      raw: inlineCodeMatch[0],
      text: inlineCodeMatch[1],
    });
  }

  const strongMatch = STRONG_PATTERN.exec(text);
  if (strongMatch && strongMatch.index !== undefined) {
    candidates.push({
      type: 'strong',
      index: strongMatch.index,
      raw: strongMatch[0],
      text: strongMatch[1] ?? strongMatch[2],
    });
  }

  const emphasisMatch = EMPHASIS_PATTERN.exec(text);
  if (emphasisMatch && emphasisMatch.index !== undefined) {
    candidates.push({
      type: 'emphasis',
      index: emphasisMatch.index,
      raw: emphasisMatch[0],
      text: emphasisMatch[1] ?? emphasisMatch[2],
    });
  }

  const sourceRefMatch = SOURCE_REF_PATTERN.exec(text);
  if (sourceRefMatch && sourceRefMatch.index !== undefined) {
    candidates.push({
      type: 'sourceRef',
      index: sourceRefMatch.index,
      raw: sourceRefMatch[0],
      text: sourceRefMatch[0],
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((left, right) => left.index - right.index);
  return candidates[0] ?? null;
}

function headingStyle(level: number) {
  if (level === 1) {
    return { fontSize: 22, lineHeight: 28 };
  }
  if (level === 2) {
    return { fontSize: 19, lineHeight: 26 };
  }
  if (level === 3) {
    return { fontSize: 17, lineHeight: 24 };
  }

  return { fontSize: 15, lineHeight: 22 };
}

function createStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: BLOCK_GAP,
    },
    paragraph: {
      color: theme.text,
      fontSize: 15,
      lineHeight: 22,
    },
    heading: {
      fontWeight: '700',
    },
    list: {
      gap: 8,
    },
    listRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    listMarker: {
      color: theme.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      width: 20,
      fontWeight: '700',
    },
    listText: {
      flex: 1,
    },
    blockquote: {
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: theme.surfaceMuted,
      borderRadius: 10,
    },
    blockquoteText: {
      color: theme.textSecondary,
    },
    codeBlock: {
      backgroundColor: theme.backgroundSelected,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    codeBlockText: {
      color: theme.text,
      fontFamily: Fonts.mono,
      fontSize: 13,
      lineHeight: 20,
    },
    inlineCode: {
      backgroundColor: theme.backgroundSelected,
      color: theme.text,
      fontFamily: Fonts.mono,
      fontSize: 13,
      lineHeight: 20,
      borderRadius: 6,
      overflow: 'hidden',
    },
    strong: {
      fontWeight: '700',
    },
    emphasis: {
      fontStyle: 'italic',
    },
    link: {
      color: theme.accent,
      textDecorationLine: 'underline',
    },
    sourceRef: {
      color: theme.accentStrong,
      fontWeight: '600',
      backgroundColor: theme.surfaceMuted,
      fontSize: 13,
      paddingHorizontal: 2,
      borderRadius: 4,
    },
  });
}
