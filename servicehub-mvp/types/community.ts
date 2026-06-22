// Tidbits community — shared TypeScript types for ServiceHub.
//
// These mirror the SQL schema in
// `servicehub-mvp/scripts/2026_community_tidbits.sql` 1:1. Whenever a
// column is added there, update the matching field here.

export type VoteTarget = 'post' | 'answer';
export type ReportTarget = 'post' | 'answer' | 'user';
export type ReportStatus =
  | 'open'
  | 'resolved_kept'
  | 'resolved_removed'
  | 'resolved_warned';
export type BadgeTier = 'bronze' | 'silver' | 'gold';
export type BadgeMetric = 'karma' | 'posts' | 'accepted';

/**
 * The DB row exactly as stored. Use this for trusted server-side code.
 */
export interface CommunityProfileRow {
  user_id: string;
  pseudonym: string;
  bio: string | null;
  avatar_url: string | null;
  is_public: boolean;
  show_posts: boolean;
  show_answers: boolean;
  show_paths: boolean;
  show_tasks: boolean;
  show_calendar: boolean;
  karma: number;
  is_suspended: boolean;
  suspended_reason: string | null;
  suspended_until: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * What we return to the public-facing client after applying visibility
 * rules. Some fields are stripped when the profile is private or the
 * section is hidden.
 */
export interface CommunityProfilePublic {
  user_id: string;
  pseudonym: string;
  bio: string | null;
  avatar_url: string | null;
  karma: number;
  badges: BadgeGrantRow[];
  // Section visibility — `null` means the section is hidden from this viewer.
  posts: CommunityPostSummary[] | null;
  answers: CommunityAnswerSummary[] | null;
  // Follow state from the perspective of the requesting viewer.
  follower_count: number;
  following_count: number;
  is_followed_by_viewer: boolean;
}

export interface CommunityPostRow {
  id: string;
  author_id: string;
  title: string;
  body_markdown: string;
  barrier_tags: string[];
  category_tags: string[];
  image_urls: string[];
  upvotes: number;
  downvotes: number;
  score: number;
  answer_count: number;
  view_count: number;
  accepted_answer_id: string | null;
  solved_tldr: string | null;
  solved_key_insight: string | null;
  is_locked: boolean;
  locked_reason: string | null;
  locked_by: string | null;
  locked_at: string | null;
  is_deleted: boolean;
  deleted_by: string | null;
  deleted_at: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * What gets sent to the feed page (lightweight; full body trimmed).
 */
export interface CommunityPostSummary {
  id: string;
  title: string;
  excerpt: string;
  author: CommunityAuthorBadge;
  barrier_tags: string[];
  category_tags: string[];
  upvotes: number;
  downvotes: number;
  score: number;
  answer_count: number;
  view_count: number;
  is_solved: boolean;
  solved_tldr: string | null;
  solved_key_insight: string | null;
  is_locked: boolean;
  has_images: boolean;
  last_activity_at: string;
  created_at: string;
  viewer_vote: -1 | 0 | 1;
}

/**
 * Full post payload for the detail page.
 */
export interface CommunityPostDetail extends CommunityPostSummary {
  body_markdown: string;
  image_urls: string[];
  answers: CommunityAnswerNode[];
  viewer_can_edit: boolean;
  viewer_can_accept: boolean;
  viewer_can_moderate: boolean;
}

export interface CommunityAnswerRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_id: string;
  body_markdown: string;
  image_urls: string[];
  upvotes: number;
  downvotes: number;
  score: number;
  is_accepted: boolean;
  accepted_at: string | null;
  is_deleted: boolean;
  deleted_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityAnswerSummary {
  id: string;
  post_id: string;
  body_markdown: string;
  upvotes: number;
  downvotes: number;
  score: number;
  is_accepted: boolean;
  created_at: string;
}

/**
 * Threaded answer payload. Children are recursive.
 */
export interface CommunityAnswerNode {
  id: string;
  post_id: string;
  parent_id: string | null;
  author: CommunityAuthorBadge;
  body_markdown: string;
  image_urls: string[];
  upvotes: number;
  downvotes: number;
  score: number;
  is_accepted: boolean;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
  viewer_vote: -1 | 0 | 1;
  viewer_can_edit: boolean;
  viewer_can_delete: boolean;
  children: CommunityAnswerNode[];
}

/**
 * Compact author block used everywhere a post/answer is rendered.
 */
export interface CommunityAuthorBadge {
  user_id: string;
  pseudonym: string;
  avatar_url: string | null;
  karma: number;
  is_public: boolean;
  top_badges: BadgeGrantRow[];
}

export interface BadgeRow {
  slug: string;
  name: string;
  description: string;
  icon: string;
  tier: BadgeTier;
  auto_metric: BadgeMetric | null;
  auto_threshold: number | null;
}

export interface BadgeGrantRow {
  id: string;
  user_id: string;
  badge_slug: string;
  granted_at: string;
  granted_by: string | null;
  badge?: BadgeRow;
}

export interface CommunityReportRow {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  status: ReportStatus;
  resolved_by: string | null;
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

/**
 * Returned by the admin moderation queue endpoint. Enriches each report
 * with the target's title / excerpt + reporter pseudonym.
 */
export interface CommunityReportEnriched extends CommunityReportRow {
  reporter_pseudonym: string | null;
  target_title: string | null;
  target_excerpt: string | null;
  target_author_pseudonym: string | null;
  target_author_id: string | null;
}

export interface CommunityFollowRow {
  follower_id: string;
  followee_id: string;
  created_at: string;
}

/** Sort modes supported by the feed. */
export type FeedSort = 'recent' | 'top' | 'unanswered' | 'solved';

export interface FeedQuery {
  sort: FeedSort;
  // Free-text search across title + body (trigram-backed).
  q?: string;
  barrier?: string;
  category?: string;
  author?: string;
  page?: number;
  page_size?: number;
}

/** Solved-line payload used by the accept-answer flow. */
export interface SolvedPayload {
  key_insight: string;
  tldr: string;
}

/** Visibility flags that the settings page edits. */
export interface CommunityVisibilitySettings {
  is_public: boolean;
  show_posts: boolean;
  show_answers: boolean;
  show_paths: boolean;
  show_tasks: boolean;
  show_calendar: boolean;
}

/**
 * Optional admin-only payload for resolving a report.
 */
export interface ResolveReportPayload {
  status: Exclude<ReportStatus, 'open'>;
  note?: string;
  // When the resolution is "remove content", which targets to act on.
  remove_target?: boolean;
  lock_post?: boolean;
}
