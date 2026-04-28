import { pinyin } from "pinyin";

// STYLE_NORMAL = 0 (no tones)
export function toPinyin(name: string): string {
  return (pinyin(name, { style: 0 }) as string[][])
    .flat()
    .join("")
    .toLowerCase();
}
