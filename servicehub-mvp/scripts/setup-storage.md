# Supabase Storage Setup

## Create Storage Bucket for Rating Images

The rating system uses Supabase Storage to store uploaded images. You need to create a storage bucket manually.

### Steps:

1. **Go to Supabase Dashboard** → Your Project
2. **Navigate to Storage** (left sidebar)
3. **Click "Create a new bucket"**
4. **Configure the bucket:**
   - **Name**: `resource-images` (must match the bucket name used in the code)
   - **Public bucket**: ✅ **Enable** (so images can be accessed via public URLs)
   - **File size limit**: 500 KB (matches the compression limit)
   - **Allowed MIME types**: `image/*` (optional, but recommended)
5. **Click "Create bucket"**

### Storage Policies

After creating the bucket, set up RLS policies:

1. Go to **Storage** → **Policies** → Select `resource-images` bucket
2. Create policies:

#### Policy 1: Users can upload images
```sql
CREATE POLICY "Users can upload rating images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'resource-images' AND
  (storage.foldername(name))[1] = 'ratings'
);
```

#### Policy 2: Anyone can view images
```sql
CREATE POLICY "Anyone can view rating images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'resource-images');
```

#### Policy 3: Users can delete their own images
```sql
CREATE POLICY "Users can delete own rating images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resource-images' AND
  (storage.foldername(name))[2] = auth.uid()::text
);
```

### Storage Structure

Images are stored in the following structure:
```
resource-images/
  └── ratings/
      └── {resourceId}/
          └── {userId}/
              └── {timestamp}_{index}.{ext}
```

Example:
```
resource-images/ratings/abc123/xyz789/1704067200000_0.jpg
```

### Free Tier Limits

- **Storage**: 1 GB (free tier)
- **File size**: 500 KB per image (after compression)
- **Max images per rating**: 2 images

If you need more storage, consider upgrading your Supabase plan or implementing image cleanup policies.