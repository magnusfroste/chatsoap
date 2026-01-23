-- Create table for room spreadsheet data
CREATE TABLE public.room_spreadsheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Untitled Spreadsheet',
  data JSONB NOT NULL DEFAULT '{"cells": {}, "columns": 10, "rows": 20}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(room_id)
);

-- Enable RLS
ALTER TABLE public.room_spreadsheets ENABLE ROW LEVEL SECURITY;

-- Create policies for room members
CREATE POLICY "Room members can view spreadsheet"
  ON public.room_spreadsheets
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = room_spreadsheets.room_id
    AND room_members.user_id = auth.uid()
  ));

CREATE POLICY "Room members can create spreadsheet"
  ON public.room_spreadsheets
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = room_spreadsheets.room_id
    AND room_members.user_id = auth.uid()
  ));

CREATE POLICY "Room members can update spreadsheet"
  ON public.room_spreadsheets
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = room_spreadsheets.room_id
    AND room_members.user_id = auth.uid()
  ));

-- Enable realtime for spreadsheet changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_spreadsheets;

-- Add index for performance
CREATE INDEX idx_room_spreadsheets_room_id ON public.room_spreadsheets(room_id);