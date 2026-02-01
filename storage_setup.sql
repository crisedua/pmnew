-- Create a new private bucket 'project-documents'
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', true)
on conflict (id) do nothing;

-- Set up access policies for the storage bucket
-- We use unique names to avoid conflicts with existing policies
create policy "Upload project-documents"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'project-documents' );

create policy "Update project-documents"
on storage.objects for update
to authenticated
using ( bucket_id = 'project-documents' );

create policy "View project-documents"
on storage.objects for select
to authenticated
using ( bucket_id = 'project-documents' );

create policy "Delete project-documents"
on storage.objects for delete
to authenticated
using ( bucket_id = 'project-documents' );
