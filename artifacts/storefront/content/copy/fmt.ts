import type { TemplateTokens } from './types';

/**
 * Safely interpolates {token} placeholders in a template string.
 * Throws an Error if a required {token} is missing from the tokens object.
 */
export function fmt(template: string, tokens: TemplateTokens): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (!(key in tokens)) {
      throw new Error(`[fmt] Missing required token "${key}" for template: "${template}"`);
    }
    return String(tokens[key]);
  });
}
