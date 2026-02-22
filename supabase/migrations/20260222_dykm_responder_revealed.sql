-- Add responder_revealed column to dykm_scores
ALTER TABLE dykm_scores ADD COLUMN IF NOT EXISTS responder_revealed BOOLEAN DEFAULT false;
