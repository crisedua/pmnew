-- Create table for WhatsApp Analysis
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view whatsapp conversations for their areas" ON whatsapp_conversations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM area_members
            WHERE area_members.area_id = whatsapp_conversations.area_id
            AND area_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert whatsapp conversations for their areas" ON whatsapp_conversations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM area_members
            WHERE area_members.area_id = whatsapp_conversations.area_id
            AND area_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update whatsapp conversations for their areas" ON whatsapp_conversations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM area_members
            WHERE area_members.area_id = whatsapp_conversations.area_id
            AND area_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete whatsapp conversations for their areas" ON whatsapp_conversations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM area_members
            WHERE area_members.area_id = whatsapp_conversations.area_id
            AND area_members.user_id = auth.uid()
        )
    );
