-- Add answers column to dykm_scores
ALTER TABLE dykm_scores 
ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '[]'::jsonb;

-- Create table to track paid reveals
CREATE TABLE IF NOT EXISTS dykm_response_reveals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    score_id UUID REFERENCES dykm_scores(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    viewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(score_id, question_index, viewer_id)
);

-- RLS
ALTER TABLE dykm_response_reveals ENABLE ROW LEVEL SECURITY;

-- Viewers can see their own reveals
CREATE POLICY "Users can view their own reveals" 
ON dykm_response_reveals FOR SELECT 
USING (auth.uid() = viewer_id);

-- System can insert (or users via RPC/Server Action)
CREATE POLICY "Users can insert their own reveals" 
ON dykm_response_reveals FOR INSERT 
WITH CHECK (auth.uid() = viewer_id);
