'use client';

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
  id?: string;
};

export default function Switch({ checked, onCheckedChange, label, id }: SwitchProps) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? 'bg-foreground' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
    </label>
  );
}
