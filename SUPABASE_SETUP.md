# Supabase Storage Setup Guide

## Creating the Storage Bucket

To enable file uploads, you need to create a storage bucket in your Supabase project:

1. **Go to your Supabase Dashboard**
   - Navigate to: https://supabase.com/dashboard
   - Select your project

2. **Create the Storage Bucket**
   - Click on "Storage" in the left sidebar
   - Click "New bucket"
   - Name: `hris-files` (or match your `SUPABASE_BUCKET_NAME` env variable)
   - Make it **Public** (or configure RLS policies if you need private storage)
   - Click "Create bucket"

3. **Configure Bucket Settings (if needed)**
   - If you made it private, you'll need to set up Row Level Security (RLS) policies
   - For public buckets, files will be accessible via public URLs

## Verifying Your Setup

After creating the bucket, verify your `.env` file has:

```env
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_BUCKET_NAME="hris-files"
STORAGE_PROVIDER="supabase"
```

## Troubleshooting

### Error: "fetch failed" or "ENOTFOUND"
**DNS resolution failed** - The Supabase hostname cannot be resolved. This usually means:

1. **Project deleted or paused**: 
   - Go to https://supabase.com/dashboard
   - Check if your project still exists
   - If paused, reactivate it
   - If deleted, you'll need to create a new project

2. **Incorrect URL**:
   - Go to your Supabase project dashboard
   - Navigate to Settings > API
   - Copy the correct "Project URL" (should look like `https://xxxxx.supabase.co`)
   - Update `SUPABASE_URL` in your `.env` file
   - Restart your Next.js dev server

3. **Network/DNS issue**:
   - Check your internet connection
   - Try accessing https://supabase.com in your browser
   - Try restarting your router/network

### Error: "Bucket doesn't exist"
- Create the bucket in Supabase dashboard (see above)
- Verify `SUPABASE_BUCKET_NAME` in `.env` matches the bucket name exactly

### Error: "Bucket not found"
- The bucket name in your `.env` doesn't match the bucket name in Supabase
- Make sure `SUPABASE_BUCKET_NAME` matches exactly (case-sensitive)

### Error: "Permission denied" or RLS errors
- If using a private bucket, configure RLS policies in Supabase
- Or make the bucket public for simpler setup
- Ensure you're using `SUPABASE_SERVICE_ROLE_KEY` (not `SUPABASE_ANON_KEY`) for admin operations

## Testing the Upload

Once the bucket is created, try uploading a profile picture again. The error should be resolved.
