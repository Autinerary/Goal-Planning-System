/**
 * Tidbits — server-side visibility filter.
 *
 * Even though /community is a community area, users can hide individual
 * sections (calendar, tasks, paths, posts, answers) or make their whole
 * profile private. The rules below MUST be applied at the API layer
 * before we return data — never trust the client to hide things itself.
 */

import type { CommunityProfileRow } from '@/types/community';

export interface VisibilityContext {
  viewer_id: string | null;
  is_admin: boolean;
}

/**
 * Returns a normalised view of a profile's visibility, with the viewer's
 * relationship taken into account. If the profile is private, ALL sections
 * are forced false except for the owner / admin.
 */
export function resolveVisibility(
  profile: Pick<
    CommunityProfileRow,
    | 'user_id'
    | 'is_public'
    | 'show_posts'
    | 'show_answers'
    | 'show_paths'
    | 'show_tasks'
    | 'show_calendar'
  >,
  ctx: VisibilityContext
): {
  can_view_profile: boolean;
  can_view_posts: boolean;
  can_view_answers: boolean;
  can_view_paths: boolean;
  can_view_tasks: boolean;
  can_view_calendar: boolean;
} {
  const isOwner = !!ctx.viewer_id && ctx.viewer_id === profile.user_id;
  const isAdmin = ctx.is_admin;
  const bypass = isOwner || isAdmin;

  // Private profile: only owner/admin sees anything.
  if (!profile.is_public && !bypass) {
    return {
      can_view_profile: false,
      can_view_posts: false,
      can_view_answers: false,
      can_view_paths: false,
      can_view_tasks: false,
      can_view_calendar: false,
    };
  }

  return {
    can_view_profile: true,
    can_view_posts: bypass || profile.show_posts,
    can_view_answers: bypass || profile.show_answers,
    can_view_paths: bypass || profile.show_paths,
    can_view_tasks: bypass || profile.show_tasks,
    can_view_calendar: bypass || profile.show_calendar,
  };
}
