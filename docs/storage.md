# K-12Buddy Storage Architecture

## Overview

K-12Buddy uses Supabase Storage for managing:
- Textbook page images (scans)
- Cover images
- OCR artifacts
- Student uploads

## Buckets

### `textbook-uploads`
Primary bucket for all textbook-related image uploads.

| Property | Value |
|----------|-------|
| Public | No |
| Max File Size | 50MB |
| Allowed MIME Types | image/png, image/jpeg, image/webp, application/pdf |

### `textbook-artifacts`
Processed artifacts from OCR and ingestion.

| Property | Value |
|----------|-------|
| Public | No |
| Max File Size | 10MB |
| Allowed MIME Types | application/json, text/plain |

### `student-uploads`
Student-uploaded images (homework, questions).

| Property | Value |
|----------|-------|
| Public | No |
| Max File Size | 10MB |
| Allowed MIME Types | image/png, image/jpeg, image/webp |

## Path Conventions

All paths follow a strict owner-based hierarchy:

```
/{owner_user_id}/{resource_type}/{resource_id}/{filename}
```

### Textbook Uploads
```
textbook-uploads/
└── {owner_user_id}/
    └── {textbook_id}/
        ├── cover/
        │   └── cover.jpg
        ├── toc/
        │   ├── toc_001.jpg
        │   └── toc_002.jpg
        └── pages/
            ├── page_001.jpg
            ├── page_002.jpg
            └── ...
```

### Textbook Artifacts
```
textbook-artifacts/
└── {owner_user_id}/
    └── {textbook_id}/
        ├── ocr/
        │   ├── cover.json
        │   ├── toc_001.json
        │   └── page_042.json
        └── chunks/
            └── manifest.json
```

### Student Uploads
```
student-uploads/
└── {owner_user_id}/
    └── {student_id}/
        ├── questions/
        │   └── {timestamp}.jpg
        ├── assignments/
        │   └── {timestamp}.jpg
        └── scans/
            └── {timestamp}.jpg
```

## Security Policies

### Ownership-Based Access

Users can only access paths under their own `owner_user_id`:

```sql
-- Insert policy: Users can upload to their own path
CREATE POLICY uploads_insert ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'textbook-uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Select policy: Users can read from their own path
CREATE POLICY uploads_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'textbook-uploads'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

### Service Role Access

Edge Functions use the service role key to:
- Process images across all user paths
- Write OCR artifacts
- Read from any path for AI processing

**Important**: Service role key must NEVER be exposed to clients.

## Upload Flow

### 1. Client Upload (Direct)

```typescript
// Client: Direct upload with authentication
const path = `${userId}/${textbookId}/pages/page_042.jpg`;

const { data, error } = await supabase.storage
  .from('textbook-uploads')
  .upload(path, imageBlob, {
    contentType: 'image/jpeg',
  });
```

### 2. Record in Database

```typescript
// Create ingestion record
await supabase.from('ingestions').insert({
  textbook_id: textbookId,
  upload_type: 'page',
  storage_path: path,
  status: 'pending',
  page_number: 42,
});
```

### 3. Call OCR Processing

```typescript
// Trigger OCR via Edge Function
const { data } = await supabase.functions.invoke('ai_ocr', {
  body: {
    student_id: studentId,
    textbook_id: textbookId,
    image_path: path,
    doc_type: 'page',
  },
});
```

## Processing Flow

### OCR Processing

```
1. Client uploads image to textbook-uploads
2. Client creates ingestion record (status: pending)
3. Client calls Edge Function: ai_ocr
4. Edge Function:
   a. Downloads image from storage (service role)
   b. Calls OpenAI Vision API
   c. Saves OCR result to textbook-artifacts
   d. Updates ingestion record (status: completed)
   e. Returns structured OCR data
```

### Retrieval for Chat

```
1. Client sends chat message with context
2. Edge Function:
   a. Retrieves relevant chunks from DB
   b. If chunk references page image, fetches from storage
   c. Includes page numbers in citations
   d. Returns response with citations
```

## File Naming Conventions

### Images
- Cover: `cover.jpg`
- TOC pages: `toc_001.jpg`, `toc_002.jpg`, etc.
- Content pages: `page_001.jpg`, `page_042.jpg`, etc.
- Student uploads: `{timestamp}.jpg`

### Artifacts
- OCR results: `{source_filename}.json`
- Manifests: `manifest.json`

## Usage Examples

### Uploading a Student Image (Client)

```typescript
const filename = `${userId}/${studentId}/scan/${Date.now()}.jpg`;

const { error } = await supabase.storage
  .from('student-uploads')
  .upload(filename, blob, {
    contentType: 'image/jpeg',
  });
```

### Processing with Edge Function (Server)

```typescript
// Service client bypasses RLS
const { data } = await serviceClient.storage
  .from('student-uploads')
  .download(imagePath);
```

### Saving OCR Results (Server)

```typescript
await serviceClient.storage
  .from('textbook-artifacts')
  .upload(artifactPath, JSON.stringify(result), {
    contentType: 'application/json',
  });
```

## Error Handling

### Upload Failures

```typescript
const { data, error } = await supabase.storage
  .from('textbook-uploads')
  .upload(path, blob);

if (error) {
  if (error.message.includes('Payload too large')) {
    throw new Error('File size exceeds 50MB limit');
  }
  if (error.message.includes('mime type')) {
    throw new Error('Invalid file type. Please upload JPG, PNG, or PDF.');
  }
  throw error;
}
```

### Missing Files

```typescript
const { data, error } = await supabase.storage
  .from('textbook-uploads')
  .download(path);

if (error?.message.includes('not found')) {
  throw new Error('File not found. Please re-upload.');
}
```

## Security Considerations

1. **No Direct Public Access**: All buckets are private
2. **Owner-Based Isolation**: Users can only access their own paths
3. **Service Role for Processing**: AI functions use service role
4. **Path Validation**: Always validate paths before operations
5. **Never expose service key**: Client must never have service role key

## Best Practices

1. **Always validate ownership** before storage operations
2. **Compress images** before upload (target: 1-2MB per page)
3. **Log all operations** for debugging and audit
4. **Set appropriate cache headers** for frequently accessed images
5. **Use consistent naming** for easy discovery and management
