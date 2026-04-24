import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RecipientEmailsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (emails: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const commit = (raw: string) => {
    const candidates = raw
      .split(/[\s,]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (candidates.length === 0) return;
    const invalid = candidates.find((c) => !EMAIL_RE.test(c));
    if (invalid) {
      setError(`"${invalid}" is not a valid email`);
      return;
    }
    const merged = Array.from(new Set([...value, ...candidates]));
    onChange(merged);
    setDraft('');
    setError(null);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const remove = (email: string) => onChange(value.filter((e) => e !== email));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 rounded-md border bg-background p-2 min-h-[42px]">
        {value.map((email) => (
          <span key={email} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
            {email}
            <button type="button" onClick={() => remove(email)} className="hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          className="flex-1 min-w-[140px] border-0 shadow-none focus-visible:ring-0 px-1 h-7"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => draft && commit(draft)}
          placeholder={value.length === 0 ? 'a@example.com, b@example.com…' : ''}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Press Enter, comma, or space to add. {value.length} recipient{value.length === 1 ? '' : 's'}.</p>
    </div>
  );
}
