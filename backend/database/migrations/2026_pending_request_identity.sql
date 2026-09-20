-- =====================================================================
-- You can see who is asking to connect with you
--
-- The profiles_read policy let you read a profile when it was yours,
-- when it was marked discoverable, or when you were already CONNECTED.
-- A pending request is none of those. So when someone with
-- discoverable = false sent a friend request, the recipient could not
-- read the requester's profile at all, and the inbox fell back to the
-- name stored on the connection row -- which is the name the requester
-- typed for the RECIPIENT. Testers saw their own name on the request.
--
-- Being asked to connect is itself consent to be identified to the
-- person you asked: you cannot sensibly accept or decline a request
-- from someone you are not allowed to see. This extends the policy to
-- pending rows in either direction, and no further -- a pending request
-- reveals a profile only to the two people in it.
--
-- Idempotent. Safe to re-run.
-- =====================================================================

DROP POLICY IF EXISTS "profiles_read" ON public.profiles;
CREATE POLICY "profiles_read"
  ON public.profiles
  FOR SELECT
  USING (
    id = auth.uid()
    OR discoverable = true
    OR EXISTS (
      SELECT 1 FROM public.social_connections sc
      WHERE sc.status IN ('connected', 'pending')
        AND (
          (sc.owner_id = auth.uid() AND sc.target_user_id = profiles.id)
          OR (sc.target_user_id = auth.uid() AND sc.owner_id = profiles.id)
        )
    )
  );

COMMENT ON POLICY "profiles_read" ON public.profiles IS
  'Readable when it is yours, when it is discoverable, or when a connection row links you to it -- connected or pending. Pending is included so the person deciding on a friend request can see who sent it.';


-- ---------------------------------------------------------------
-- Backfill: clear the placeholder role on already-accepted rows.
--
-- `role` is a human-readable subtitle, but sending a request filled it
-- with the literal text 'Pending Request'. Accept only ever flipped
-- `status`, so connections that have been accepted for weeks still read
-- "Pending Request" on the card.
--
-- This clears that text on CONNECTED rows only, and only where it is
-- exactly one of the two placeholders the app writes. A role anybody
-- actually typed is left untouched, and no row is removed.
-- ---------------------------------------------------------------
UPDATE public.social_connections
   SET role = ''
 WHERE status = 'connected'
   AND trim(role) IN ('Pending Request', 'Pending Connection');
