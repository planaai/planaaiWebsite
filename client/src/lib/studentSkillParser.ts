import { computeDiff } from '@/lib/diffUtils';
import { sanitizeHtml } from '@/lib/sanitize';

export interface ParseSkillDescriptionOptions {
  highlightClass?: string;
  yellowClass?: string;
  baseTemplate?: string;
  baseParameters?: Record<string, string[]>;
}

export function parseSkillDescriptionCore(
  template: string,
  parameters: Record<string, string[]>,
  levelOrIndex: number,
  options?: { highlightClass?: string; yellowClass?: string }
): string {
  if (!template) return '설명이 없습니다.';
  let parsed = template;
  const idx = Math.max(0, levelOrIndex);
  const highlightClass = options?.highlightClass || 'text-blue-500 font-bold';
  const yellowClass = options?.yellowClass || 'text-yellow-600 font-bold';

  if (parameters) {
    Object.entries(parameters).forEach(([key, values]) => {
      if (values && values.length > 0) {
        const val = values[Math.min(idx, values.length - 1)];
        const regexStr1 = `<b:\\{\\{?${key}\\}?\\}>`;
        const regexStr2 = `\\{\\{?${key}\\}?\\}`;
        parsed = parsed.replace(new RegExp(regexStr1, 'g'), `<span class="${highlightClass}">${val}</span>`);
        parsed = parsed.replace(new RegExp(regexStr2, 'g'), val);
      }
    });
  }

  parsed = parsed.replace(/<[^>]*>/g, (match) => {
    if (match.startsWith('<span')) return match;
    if (match === '</span>') return match;
    if (match === '<y>') return `<span class="${yellowClass}">`;
    if (match === '</y>') return '</span>';
    return '';
  });

  parsed = parsed.replace(/\n/g, '<br />');

  return sanitizeHtml(parsed);
}

export function parseSkillDescription(
  template: string,
  parameters: Record<string, string[]>,
  levelOrIsEx: number | boolean,
  options?: ParseSkillDescriptionOptions
): string {
  const index = typeof levelOrIsEx === 'boolean'
    ? (levelOrIsEx ? 4 : 9)
    : Math.max(0, levelOrIsEx - 1);

  const parsed = parseSkillDescriptionCore(template, parameters, index, options);

  if (options?.baseTemplate) {
    const baseParsed = parseSkillDescriptionCore(
      options.baseTemplate,
      options.baseParameters || {},
      index,
      options
    );
    return sanitizeHtml(computeDiff(baseParsed, parsed));
  }

  return parsed;
}
