-- Create a new private bucket 'project-documents'
insert into storage.buckets (id, name, public)
values ('project-documents', 'project-documents', true)
on conflict (id) do nothing;

-- Set up access policies for the storage bucket
create policy "Authenticated users can upload files"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'project-documents' );

create policy "Authenticated users can update files"
on storage.objects for update
to authenticated
using ( bucket_id = 'project-documents' );

create policy "Authenticated users can view files"
on storage.objects for select
to authenticated
using ( bucket_id = 'project-documents' );

create policy "Authenticated users can delete files"
on storage.objects for delete
to authenticated
using ( bucket_id = 'project-documents' );
