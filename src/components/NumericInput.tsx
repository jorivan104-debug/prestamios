import { useEffect, useState } from "react";
import { formatEsDecimal, parseSpanishNumber } from "../lib/numberEs";

type Props = {
  value: number;
  onChange: (n: number) => void;
  fractionDigits?: number;
  className?: string;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  min?: number;
  max?: number;
};

export default function NumericInput({
  value,
  onChange,
  fractionDigits = 2,
  className,
  disabled,
  id,
  placeholder,
  min,
  max,
}: Props) {
  const [text, setText] = useState(() => formatEsDecimal(value, fractionDigits));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(formatEsDecimal(value, fractionDigits));
  }, [value, focused, fractionDigits]);

  const clamp = (n: number) => {
    let x = n;
    if (min !== undefined && x < min) x = min;
    if (max !== undefined && x > max) x = max;
    return x;
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={className}
      disabled={disabled}
      placeholder={placeholder}
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const parsed = parseSpanishNumber(text);
        const n = Number.isFinite(parsed) ? clamp(parsed) : value;
        onChange(n);
        setText(formatEsDecimal(n, fractionDigits));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const parsed = parseSpanishNumber(raw);
        if (Number.isFinite(parsed)) onChange(clamp(parsed));
      }}
    />
  );
}
