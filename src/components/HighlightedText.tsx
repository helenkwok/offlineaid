/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React from 'react';
import { Text, type TextStyle, type TextProps } from 'react-native';

interface HighlightedTextProps extends TextProps {
  text: string;
  highlightStyle?: TextStyle;
}

/**
 * Renders text with FTS5 highlight markers (**term**) as styled bold segments.
 */
export function HighlightedText({ text, style, highlightStyle, ...props }: HighlightedTextProps) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  
  return (
    <Text style={style} {...props}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={[{ fontWeight: 'bold' }, highlightStyle]}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}
