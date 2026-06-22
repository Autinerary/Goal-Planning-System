/**
 * Tidbits — server-side answer threading helpers.
 *
 * Database stores answers in a flat table with `parent_id` pointers. The
 * UI wants a tree. We do the assembly here so the API + future server
 * components can reuse it without re-implementing.
 */

import type {
  CommunityAnswerNode,
  CommunityAuthorBadge,
} from '@/types/community';

interface AnswerRowLite {
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
  created_at: string;
  updated_at: string;
}

/**
 * Build the tree. Sorts each level by (is_accepted desc, score desc,
 * created_at asc) so the accepted answer sits at the top and the most-
 * helpful replies float up within each thread.
 *
 * @param authors   Map<author_id, CommunityAuthorBadge> for hydration.
 * @param votes     Map<answer_id, viewer_vote> for the current viewer.
 * @param viewerId  The currently logged-in user (for ownership flags).
 * @param isAdmin   Whether the viewer is an admin.
 */
export function buildAnswerTree(
  rows: AnswerRowLite[],
  authors: Map<string, CommunityAuthorBadge>,
  votes: Map<string, -1 | 0 | 1>,
  viewerId: string | null,
  isAdmin: boolean
): CommunityAnswerNode[] {
  const placeholder: CommunityAuthorBadge = {
    user_id: '',
    pseudonym: 'unknown',
    avatar_url: null,
    karma: 0,
    is_public: false,
    top_badges: [],
  };

  const nodes = new Map<string, CommunityAnswerNode>();
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      post_id: r.post_id,
      parent_id: r.parent_id,
      author: authors.get(r.author_id) ?? { ...placeholder, user_id: r.author_id },
      body_markdown: r.body_markdown,
      image_urls: r.image_urls,
      upvotes: r.upvotes,
      downvotes: r.downvotes,
      score: r.score,
      is_accepted: r.is_accepted,
      accepted_at: r.accepted_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
      viewer_vote: votes.get(r.id) ?? 0,
      viewer_can_edit: !!viewerId && viewerId === r.author_id,
      viewer_can_delete: !!viewerId && (viewerId === r.author_id || isAdmin),
      children: [],
    });
  }

  const roots: CommunityAnswerNode[] = [];
  for (const node of nodes.values()) {
    if (node.parent_id && nodes.has(node.parent_id)) {
      nodes.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sort = (a: CommunityAnswerNode, b: CommunityAnswerNode) => {
    if (a.is_accepted !== b.is_accepted) return a.is_accepted ? -1 : 1;
    if (a.score !== b.score) return b.score - a.score;
    return a.created_at < b.created_at ? -1 : 1;
  };
  const sortTree = (nodes: CommunityAnswerNode[]) => {
    nodes.sort(sort);
    for (const n of nodes) sortTree(n.children);
  };
  sortTree(roots);
  return roots;
}
