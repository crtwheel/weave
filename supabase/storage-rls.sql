-- Create private bucket (run via Supabase Dashboard SQL Editor)
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-files', 'template-files', false)
ON CONFLICT (id) DO NOTHING;

-- Only authenticated users with a verified purchase can download
CREATE POLICY "download_verified_purchases"
  ON storage.objects FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM purchases p
      JOIN templates t ON p.template_id = t.id
      WHERE p.user_id = auth.uid()
        AND p.status = 'verified'
        AND t.storage_path = storage.objects.name
    )
  );
