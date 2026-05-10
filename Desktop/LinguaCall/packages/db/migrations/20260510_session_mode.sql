-- Add session_mode column to sessions table
-- Values: 'practice' (준비), 'mock' (모의, default), 'real' (실전)
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS session_mode VARCHAR(20) NOT NULL DEFAULT 'mock';
