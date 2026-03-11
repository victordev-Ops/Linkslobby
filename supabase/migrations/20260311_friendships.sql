-- Migration: Friendship system
-- Allows users to send, accept, decline, and remove friend requests.

CREATE TABLE public.friendships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT friendships_no_self CHECK (requester_id <> addressee_id),
    CONSTRAINT friendships_unique_pair UNIQUE (requester_id, addressee_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX idx_friendships_status ON public.friendships(status);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view friendships they are part of
CREATE POLICY "Users can view own friendships" ON public.friendships
    FOR SELECT USING (
        auth.uid() = requester_id OR auth.uid() = addressee_id
    );

-- Policy: Users can send friend requests (as requester)
CREATE POLICY "Users can send friend requests" ON public.friendships
    FOR INSERT WITH CHECK (
        auth.uid() = requester_id
    );

-- Policy: Users can update friendships they are the addressee of (accept/decline)
CREATE POLICY "Addressee can update friendship status" ON public.friendships
    FOR UPDATE USING (
        auth.uid() = addressee_id
    );

-- Policy: Either party can delete a friendship (unfriend or cancel request)
CREATE POLICY "Either party can delete friendship" ON public.friendships
    FOR DELETE USING (
        auth.uid() = requester_id OR auth.uid() = addressee_id
    );
