import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { DEFAULT_MAX_TURNS } from '@/lib/constants';
import { fetchModels } from '@/lib/api';
import type { DebateConfig } from '@/types/debate';

interface TopicFormProps {
  onSubmit: (config: DebateConfig) => void;
  isLoading?: boolean;
}

/** Preferred default model IDs — matched against the sorted model list from the API. */
export const DEFAULT_MAKER_MODEL = 'compound-beta-mini';
export const DEFAULT_CHECKER_MODEL = 'llama-4-maverick-17b-128e-instruct';

export function TopicForm({ onSubmit, isLoading = false }: TopicFormProps) {
  const [topic, setTopic] = useState('');
  const [makerModel, setMakerModel] = useState('');
  const [checkerModel, setCheckerModel] = useState('');
  const [maxTurns, setMaxTurns] = useState(DEFAULT_MAX_TURNS);
  const [unlimitedTurns, setUnlimitedTurns] = useState(false);
  const [verbose, setVerbose] = useState(false);
  const [topicError, setTopicError] = useState('');
  const [modelOptions, setModelOptions] = useState<{ value: string; label: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    fetchModels()
      .then((data) => {
        const groq = data.groq.map((m) => ({ value: m.id, label: `${m.name} (Groq)` }));
        const or = data.openrouter.map((m) => ({ value: m.id, label: `${m.name} (OpenRouter)` }));
        const options = [...groq, ...or];
        setModelOptions(options);

        if (options.length > 0) {
          // Prefer curated defaults; fall back to first/second in the sorted list
          const makerIdx = options.findIndex((o) => o.value === DEFAULT_MAKER_MODEL);
          const checkerIdx = options.findIndex((o) => o.value === DEFAULT_CHECKER_MODEL);
          setMakerModel(makerIdx !== -1 ? options[makerIdx].value : options[0].value);
          setCheckerModel(
            checkerIdx !== -1
              ? options[checkerIdx].value
              : options[Math.min(1, options.length - 1)].value,
          );
        }
      })
      .catch(() => {
        // Leave empty — user will see empty selects
      })
      .finally(() => setModelsLoading(false));
  }, []);

  function validate(): boolean {
    if (!topic.trim()) {
      setTopicError('Topic is required.');
      return false;
    }
    if (topic.trim().length < 10) {
      setTopicError('Topic must be at least 10 characters.');
      return false;
    }
    setTopicError('');
    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      topic: topic.trim(),
      makerModel,
      checkerModel,
      maxTurns: unlimitedTurns ? 9999 : maxTurns,
      verbose,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl shadow-black/50"
      noValidate
    >
      {/* Topic */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="topic" className="text-sm font-medium text-zinc-300">
          Debate Topic <span className="text-red-400">*</span>
        </label>
        <textarea
          id="topic"
          value={topic}
          onChange={(e) => {
            setTopic(e.target.value);
            if (topicError) setTopicError('');
          }}
          placeholder="Should AI be regulated by governments?"
          rows={3}
          required
          className={cn(
            'w-full bg-zinc-950 border rounded-xl px-3 py-2.5 text-zinc-50 placeholder-zinc-600',
            'focus:outline-none focus:ring-2 transition-colors duration-150 resize-none text-sm',
            topicError
              ? 'border-red-500 focus:border-red-400 focus:ring-red-500/30'
              : 'border-zinc-700 focus:border-maker focus:ring-maker/20',
          )}
        />
        {topicError && (
          <p className="text-xs text-red-400" role="alert">
            {topicError}
          </p>
        )}
      </div>

      {/* Model selects */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="MAKER Model"
          options={modelsLoading ? [{ value: '', label: 'Loading models…' }] : modelOptions}
          value={makerModel}
          onChange={(e) => setMakerModel(e.target.value)}
          disabled={modelsLoading}
        />
        <Select
          label="CHECKER Model"
          options={modelsLoading ? [{ value: '', label: 'Loading models…' }] : modelOptions}
          value={checkerModel}
          onChange={(e) => setCheckerModel(e.target.value)}
          disabled={modelsLoading}
        />
      </div>

      {/* Max turns + toggles row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        {/* Max turns */}
        <div className="flex flex-col gap-1.5 w-full sm:w-40">
          <label htmlFor="maxTurns" className="text-sm font-medium text-zinc-300">
            Max Turns
          </label>
          <input
            id="maxTurns"
            type="number"
            min={2}
            max={20}
            value={maxTurns}
            disabled={unlimitedTurns}
            onChange={(e) =>
              setMaxTurns(Math.min(20, Math.max(2, parseInt(e.target.value, 10) || 2)))
            }
            className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-50 focus:outline-none focus:ring-2 focus:border-maker focus:ring-maker/20 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          />
        </div>

        {/* Unlimited turns toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none pb-0.5 sm:pb-2">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={unlimitedTurns}
              onChange={(e) => setUnlimitedTurns(e.target.checked)}
            />
            <div
              className={cn(
                'w-10 h-6 rounded-full transition-colors duration-200',
                unlimitedTurns ? 'bg-maker' : 'bg-zinc-700',
              )}
            />
            <div
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                unlimitedTurns ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </div>
          <span className="text-sm text-zinc-400">Unlimited turns</span>
        </label>

        {/* Verbose toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none pb-0.5 sm:pb-2">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={verbose}
              onChange={(e) => setVerbose(e.target.checked)}
            />
            <div
              className={cn(
                'w-10 h-6 rounded-full transition-colors duration-200',
                verbose ? 'bg-maker' : 'bg-zinc-700',
              )}
            />
            <div
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                verbose ? 'translate-x-4' : 'translate-x-0',
              )}
            />
          </div>
          <span className="text-sm text-zinc-400">Show thinking</span>
        </label>
      </div>

      {/* Submit */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        loading={isLoading}
        disabled={isLoading}
        className="w-full"
      >
        Start Debate →
      </Button>
    </form>
  );
}
