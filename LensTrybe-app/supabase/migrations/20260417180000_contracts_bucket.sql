INSERT INTO storage.buckets (id, name, public) 
VALUES ('contracts', 'contracts', true)
ON CONFLICT (id) DO NOTHING;

