/**
 * Tidbits — pseudonym generator.
 *
 * Every community profile uses a pseudonym; the user's real name (from
 * profiles) is never surfaced on community pages. Users can edit the
 * pseudonym later from /community/settings, but they always start with a
 * generated one so the opt-in flow is one click.
 *
 * Format: <Adjective><Noun><3-digit number>. Example: "QuietRiver421".
 */

const ADJECTIVES = [
  'Quiet', 'Bright', 'Steady', 'Curious', 'Gentle', 'Bold', 'Patient',
  'Clever', 'Calm', 'Eager', 'Kind', 'Sharp', 'Brave', 'Loyal', 'Wise',
  'Sunny', 'Lively', 'Mellow', 'Fierce', 'Tender', 'Stoic', 'Daring',
  'Humble', 'Witty', 'Honest', 'Hopeful', 'Bold', 'Crafty',
];

const NOUNS = [
  'River', 'Mountain', 'Falcon', 'Compass', 'Lantern', 'Harbor', 'Maple',
  'Garden', 'Trail', 'Beacon', 'Wren', 'Atlas', 'Aspen', 'Cedar', 'Otter',
  'Robin', 'Sparrow', 'Meadow', 'Cove', 'Brook', 'Glen', 'Ridge', 'Lark',
  'Phoenix', 'Ember', 'Quartz', 'Comet', 'Onyx',
];

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Returns a candidate pseudonym. Caller should retry on UNIQUE-violation
 * (rare; total namespace ~ 28 * 28 * 1000 = ~780k).
 */
export function generatePseudonym(): string {
  const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${pick(ADJECTIVES)}${pick(NOUNS)}${num}`;
}

/**
 * Validate a user-supplied pseudonym. Allowed: alphanumeric + underscore +
 * hyphen, 3..32 chars. Returns null if valid, otherwise an error message.
 */
export function validatePseudonym(input: string): string | null {
  if (!input) return 'Pseudonym is required';
  if (input.length < 3) return 'Pseudonym must be at least 3 characters';
  if (input.length > 32) return 'Pseudonym must be at most 32 characters';
  if (!/^[A-Za-z0-9_-]+$/.test(input)) {
    return 'Pseudonym can only contain letters, numbers, underscores, and hyphens';
  }
  return null;
}
