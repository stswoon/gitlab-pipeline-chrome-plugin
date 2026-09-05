export type OptionLike = { value: string; label: string };

export function pickOptionLike(items: OptionLike[], wanted: string): OptionLike | null {
  const byValue = items.find((item) => item.value === wanted);
  const byLabel = items.find((item) => item.label === wanted);
  if (byValue) {
    return byValue;
  }
  return byLabel ?? null;
}
