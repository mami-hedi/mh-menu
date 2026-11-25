/** Interrupteur accessible (role="switch"). */
export default function Toggle({ checked, onChange, label, disabled, size = 'md' }) {
  const dims = size === 'sm' ? { track: 'h-5 w-9', knob: 'h-4 w-4', on: 'translate-x-4' } : { track: 'h-6 w-11', knob: 'h-5 w-5', on: 'translate-x-5' };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full p-0.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${dims.track} ${checked ? 'bg-accent-500' : 'bg-navy-200'}`}
    >
      <span className={`block rounded-full bg-white shadow transition ${dims.knob} ${checked ? dims.on : 'translate-x-0'}`} />
    </button>
  );
}
