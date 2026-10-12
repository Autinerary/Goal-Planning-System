/**
 * Autinerary's own listing, or ResourceHub's under either of its names. These
 * are not places to recommend to someone using them: the AI engine "suggests
 * Autinerary to itself with a 10% match" (Riipen Labs, Groups 22 and 24).
 * Every recommender leaves them out; search and browsing still show them.
 *
 * An admin can mark a listing as first-party (is_first_party). The name check
 * is for listings that are not marked: the live "Autinerary" row is not.
 */

const SELF_NAME = /^\s*(autinerary|resource\s*hub|service\s*hub)\b/i

export interface SelfListingFields {
  name?: string | null
  is_first_party?: boolean | null
}

export function isSelfListing(r: SelfListingFields | null | undefined): boolean {
  if (!r) return false
  return r.is_first_party === true || SELF_NAME.test(r.name || '')
}

/**
 * A list cut to length before its rows are read asks for this many more, so
 * that leaving out self-listings afterwards still leaves a full list.
 */
export const SELF_LISTING_SLACK = 2
