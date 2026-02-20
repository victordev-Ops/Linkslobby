-- Create Chat Sessions Table
CREATE TABLE public.chat_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_message_preview text,
    CONSTRAINT chat_sessions_pkey PRIMARY KEY (id)
);

-- Create Chat Participants Table
CREATE TABLE public.chat_participants (
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    joined_at timestamp with time zone DEFAULT now(),
    last_read_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chat_participants_pkey PRIMARY KEY (session_id, user_id),
    CONSTRAINT chat_participants_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- Create Chat Messages Table
CREATE TABLE public.chat_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    is_system boolean DEFAULT false,
    CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
    CONSTRAINT chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    CONSTRAINT chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id)
);

-- Create Index for faster queries
CREATE INDEX idx_chat_participants_user_id ON public.chat_participants(user_id);
CREATE INDEX idx_chat_messages_session_id ON public.chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Add RLS Policies (Basic)
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Session: Users can view sessions they are participating in
CREATE POLICY "Users can view their sessions" ON public.chat_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants
            WHERE session_id = chat_sessions.id
            AND user_id = auth.uid()
        )
    );

-- Participants: Users can view participants of their sessions
CREATE POLICY "Users can view participants" ON public.chat_participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants as cp
            WHERE cp.session_id = chat_participants.session_id
            AND cp.user_id = auth.uid()
        )
    );

-- Messages: Users can view messages of their sessions
CREATE POLICY "Users can view messages" ON public.chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.chat_participants
            WHERE session_id = chat_messages.session_id
            AND user_id = auth.uid()
        )
    );

-- Messages: Users can insert messages into their sessions
CREATE POLICY "Users can insert messages" ON public.chat_messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM public.chat_participants
            WHERE session_id = chat_messages.session_id
            AND user_id = auth.uid()
        )
    );
