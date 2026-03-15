import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { cn } from '@/lib/utils';
import { MODELS, DEFAULT_MAKER_MODEL, DEFAULT_CHECKER_MODEL, DEFAULT_MAX_TURNS } from '@/lib/constants';
import type { DebateConfig } from '@/types/debate';

interface TopicFormProps {
  onSubmit: (config: DebateConfig) => void;
  isLoading?: boolean;
}

const modelOptions = MODELS.map((m) => ({ value: m.id, label: m.name }));

export function TopicForm({ onSubmit, isLoading = false }: TopicFormProps) {
  const [topic, setTopic] = useState('');
  const [makerModel, setMakerModel] = useState(DEFAULT_MAKER_MODEL);
  const [checkerModel, setCheckerModel] = useState(DEFAULT_CHECKER_MODEL);
  const [maxTurns, setMaxTurns] = useState(DEFAULT_MAX_TURNS);
  const [verbose, setVerbose] = useState(false);
  const [topicError, setTopicError] = useState('');

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
      maxTurns,
      verbose,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-2xl bg-surface border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-2xl"
      noValidate
    >
      {/* Topic */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="topic" className="text-sm font-medium text-slate-300">
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
            'w-full bg-surface-raised border rounded-lg px-3 py-2 text-slate-50 placeholder-slate-500',
            'focus:outline-none focus:ring-2 transition-colors duration-150 resize-none text-base',
            topicError
              ? 'border-red-500 focus:border-red-400 focus:ring-red-500/30'
              : 'border-slate-700 focus:border-maker focus:ring-maker/30'
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
          options={modelOptions}
          value={makerModel}
          onChange={(e) => setMakerModel(e.target.value)}
        />
        <Select
          label="CHECKER Model"
          options={modelOptions}
          value={checkerModel}
          onChange={(e) => setCheckerModel(e.target.value)}
        />
      </div>

      {/* Max turns + verbose row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
        {/* Max turns */}
        <div className="flex flex-col gap-1.5 w-full sm:w-40">
          <label htmlFor="maxTurns" className="text-sm font-medium text-slate-300">
            Max Turns
          </label>
          <input
            id="maxTurns"
            type="number"
            min={2}
            max={20}
            value={maxTurns}
            onChange={(e) =>
              setMaxTurns(Math.min(20, Math.max(2, parseInt(e.target.value, 10) || 2)))
            }
            className="w-full bg-surface-raised border border-slate-700 rounded-lg px-3 py-2 text-slate-50 focus:outline-none focus:ring-2 focus:border-maker focus:ring-maker/30 transition-colors duration-150"
          />
        </div>

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
                verbose ? 'bg-maker' : 'bg-slate-700'
              )}
            />
            <div
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
                verbose ? 'translate-x-4' : 'translate-x-0'
              )}
            />
          </div>
          <span className="text-sm text-slate-300">Show thinking (verbose)</span>
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
