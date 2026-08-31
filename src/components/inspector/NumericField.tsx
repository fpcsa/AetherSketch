import { useId, useState } from 'react';
import type { z } from 'zod';

type NumericFieldProps = {
  label: string;
  className?: string;
  inputClassName: string;
  schema: z.ZodType;
  validationHint?: string;
  min?: number;
  max?: number;
  placeholder?: string;
} & (
  | {
      optional: true;
      value: number | undefined;
      onCommit: (value: number | undefined) => void;
    }
  | {
      optional?: false;
      value: number;
      onCommit: (value: number) => void;
    }
);

function validationMessage(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'too_small':
      return `Enter a value ${issue.inclusive ? 'of at least' : 'greater than'} ${issue.minimum}.`;
    case 'too_big':
      return `Enter a value ${issue.inclusive ? 'no greater than' : 'less than'} ${issue.maximum}.`;
    case 'invalid_type':
      return issue.expected === 'int'
        ? 'Enter a whole number.'
        : 'Enter a valid number.';
    default:
      return 'Enter a valid number.';
  }
}

// Callers key this field by its saved value and entity ID so undo, reloads,
// and selection changes reset both the draft and any previous error.
export function NumericField(props: NumericFieldProps) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      className={
        props.className ??
        'block text-[11px] font-medium uppercase tracking-[0.1em] text-slate-600'
      }
    >
      <label htmlFor={id}>{props.label}</label>
      <input
        id={id}
        className={`${props.inputClassName} ${error ? 'border-rose-400! focus:border-rose-400!' : ''}`}
        type="number"
        step="any"
        min={props.min}
        max={props.max}
        placeholder={props.placeholder}
        defaultValue={props.value ?? ''}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={() => setError(null)}
        onBlur={(event) => {
          const input = event.currentTarget;
          const reject = (message: string) => {
            input.value = String(props.value ?? '');
            setError(
              `${message} ${props.value === undefined ? 'No value saved.' : `Saved value ${props.value} restored.`}`,
            );
          };
          const raw = input.value.trim();
          if (
            input.validity.badInput ||
            (raw && !Number.isFinite(Number(raw)))
          ) {
            reject('Enter a finite number.');
            return;
          }
          if (!raw && !props.optional) {
            reject('A value is required.');
            return;
          }
          const value = raw === '' ? undefined : Number(raw);
          const result = props.schema.safeParse(value);
          if (!result.success) {
            reject(
              props.validationHint ?? validationMessage(result.error.issues[0]),
            );
            return;
          }
          try {
            if (value !== props.value) {
              if (value !== undefined) props.onCommit(value);
              else if (props.optional) props.onCommit(undefined);
            }
            input.value = String(value ?? '');
            setError(null);
          } catch (error) {
            reject(
              error instanceof Error
                ? error.message
                : 'The value could not be saved.',
            );
          }
        }}
      />
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1 text-[11px] font-normal normal-case leading-4 tracking-normal text-rose-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
