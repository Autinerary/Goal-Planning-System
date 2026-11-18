/**
 * Breakdown groups (a norm, a norm's level, an organisation, a connection)
 * with fewer raters than this are left out of what is shown. A group of one
 * is that one person's norm and score, and the reviews list shows each
 * reviewer's name and score beside it, so it would say who has which norm
 * (bug audit, 17 November 2026, item 2). No imports, so pure modules (and
 * client code, if ever) can use it.
 */
export const MIN_BREAKDOWN_GROUP = 3
