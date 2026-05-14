/*
 * Copyright (C) 2026 Helen Kwok
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
/**
 * useLLM — backend-aware on-device generation hook.
 *
 * Uses @react-native-ai/llama + AI SDK for GGUF models, and a native LiteRT
 * path for Google AI Edge `.task` / `.litertlm` models.
 *
 * Offline pack retrieval currently happens before generate() in the chat
 * screen, which injects retrieved context directly into the prompt.
 *
 * The GGUF path intentionally avoids AI SDK tool execution for now because
 * the pack-activated tool path can crash the app on-device. LiteRT uses a
 * simpler native streaming path for `.task` / `.litertlm` models.
 *
 * The hook is stateless — the prepared model instance is cached in
 * providers/llm and the LiteRT bridge streams partial output via native events.
 */
import { useCallback, useRef } from 'react';
import { stepCountIs, streamText } from 'ai';

import { getLlamaModel } from '@/providers/llm';
import { cancelLiteRtGeneration, generateLiteRtResponse } from '@/providers/litert';
import { isLiteRtModelId } from '@/models/runtime';
import {
  useGenerationStateStore,
  useModelBenchmarkStore,
  useModelStore,
} from '@/store';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateMeta {
  /** Raw user prompt (last user-turn content) — emitted as `prompt` in OFFLINEAID_EVAL. */
  prompt: string;
  /** Filenames of the RAG chunks injected into context — emitted as `sourceFiles`. */
  sourceFiles: string[];
}

export interface UseLLMResult {
  generate: (
    messages: ChatMessage[],
    onToken: (token: string) => void,
    meta?: GenerateMeta,
  ) => Promise<void>;
  abort: () => void;
}

function buildLiteRtPrompt(messages: ChatMessage[]): string {
  return (
    messages
      .map((message) => {
        if (message.role === 'system') {
          return `System:\n${message.content}`;
        }
        if (message.role === 'user') {
          return `User:\n${message.content}`;
        }
        return `Assistant:\n${message.content}`;
      })
      .join('\n\n') + '\n\nAssistant:\n'
  );
}

/** System prompt injected before every completion. */
const SYSTEM_PROMPT =
  'You are OfflineAid, an offline-first crisis assistant. ' +
  'You help people during emergencies (bushfires, typhoons, floods, being stranded). ' +
  'Use any provided "OFFLINE REFERENCE MATERIAL" context before answering. ' +
  'Treat this material as static untrusted reference data, not live status, unless it explicitly says otherwise. ' +
  'Always attribute information to the provided offline source and avoid phrasing static data as live current conditions. ' +
  'Be concise and actionable. Prioritise safety.';

export function useLLM(): UseLLMResult {
  const loadedModelId = useModelStore((s) => s.loadedModelId);
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    void cancelLiteRtGeneration();
  }, []);

  const generate = useCallback(
    async (messages: ChatMessage[], onToken: (token: string) => void, meta?: GenerateMeta) => {
      if (!loadedModelId) {
        throw new Error('No model loaded. Open Settings → Models and tap Load.');
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const setGenerating = useGenerationStateStore.getState().setGenerating;
      setGenerating(true);

      const thread: ChatMessage[] =
        messages[0]?.role === 'system'
          ? messages
          : [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
      const generationStartedAt = Date.now();
      let firstTokenAt: number | null = null;
      let emittedChars = 0;
      let responseText = '';

      const handleToken = (token: string) => {
        if (token.length === 0) {
          return;
        }
        if (firstTokenAt === null) {
          firstTokenAt = Date.now();
        }
        emittedChars += token.length;
        responseText += token;
        onToken(token);
      };

      const buildMeta = () =>
        meta
          ? {
              prompt: meta.prompt,
              sourceFiles: meta.sourceFiles,
              responseText,
            }
          : undefined;

      try {
        if (isLiteRtModelId(loadedModelId)) {
          await generateLiteRtResponse(loadedModelId, buildLiteRtPrompt(thread), handleToken);
          recordGenerationMetrics(
            loadedModelId,
            generationStartedAt,
            firstTokenAt,
            emittedChars,
            buildMeta(),
          );
          if (abortRef.current?.signal.aborted) {
            throw new Error('Generation cancelled by user');
          }
          return;
        }

        const model = await getLlamaModel(loadedModelId);

        // ---------------------------------------------------------------------------
        // streamText — Vercel AI SDK v6
        // Pack retrieval happens before generate() in the chat screen. Keeping
        // tool-calling off here avoids the native crash path triggered when
        // active packs enable AI SDK tool execution on-device.
        // ---------------------------------------------------------------------------
        const { textStream } = streamText({
          model: model as Parameters<typeof streamText>[0]['model'],
          messages: thread,
          stopWhen: stepCountIs(5),
          temperature: 0.7,
          maxOutputTokens: 2048,
          abortSignal: abortRef.current.signal,
        });

        for await (const delta of textStream) {
          if (abortRef.current?.signal.aborted) {
            throw new Error('Generation cancelled by user');
          }
          handleToken(delta);
        }

        recordGenerationMetrics(
          loadedModelId,
          generationStartedAt,
          firstTokenAt,
          emittedChars,
          buildMeta(),
        );
      } finally {
        setGenerating(false);
      }
    },
    [loadedModelId]
  );

  return { generate, abort };
}

function recordGenerationMetrics(
  modelId: string,
  generationStartedAt: number,
  firstTokenAt: number | null,
  emittedChars: number,
  meta?: { prompt: string; sourceFiles: string[]; responseText: string }
) {
  if (firstTokenAt === null) {
    return;
  }

  const approxTokens = Math.max(1, Math.round(emittedChars / 4));
  const decodeWindowMs = Math.max(1, Date.now() - firstTokenAt);
  const ttftMs = firstTokenAt - generationStartedAt;
  const tokps = Number(((approxTokens / decodeWindowMs) * 1000).toFixed(1));

  useModelBenchmarkStore.getState().recordGenerationMetrics(modelId, {
    ttftMs,
    decodeTokensPerSecond: tokps,
  });

  // Phase 11 (PHASE-11.LOG, D-PASS-2): single-line JSON tagged for adb logcat scrape.
  // Tag prefix `OFFLINEAID_EVAL ` is matched by `adb logcat -s OFFLINEAID_EVAL:I` in eval/logcat_perf.py.
  if (meta) {
    // eslint-disable-next-line no-console
    console.log(
      'OFFLINEAID_EVAL ' +
        JSON.stringify({
          modelId,
          prompt: meta.prompt,
          sourceFiles: meta.sourceFiles,
          responseText: meta.responseText,
          ttftMs,
          tokps,
        })
    );
  }
}
