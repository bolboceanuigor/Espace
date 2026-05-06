'use client';

type SwitchProps = {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label?: string;
  id?: string;
};

export default function Switch({ checked, onCheckedChange, label, id }: SwitchProps) {
  return (
    <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2.5">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-200 ${
          checked
            ? 'bg-foreground'
            : 'bg-muted'
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-[22px]' : 'translate-x-1'
          }`}
          style={{ width: '18px', height: '18px' }}
        />
      </button>
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
    </label>
  );
}
