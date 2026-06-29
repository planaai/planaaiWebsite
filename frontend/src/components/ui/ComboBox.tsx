import { useId } from 'react';

interface ComboBoxProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
  placeholder?: string;
}

export function ComboBox({ label, value, onChange, options, placeholder }: ComboBoxProps) {
  const listId = useId();
  
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          list={listId}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || '직접 입력 또는 선택'}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
        />
        <datalist id={listId}>
          {options.map(o => (
            <option key={o.key} value={o.label} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
