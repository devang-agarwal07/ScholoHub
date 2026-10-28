import { useCallback, useState } from 'react';
import { useDropzone, type FileRejection } from 'react-dropzone';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface DocumentUploaderProps {
  onUpload: (file: File, documentType: string) => Promise<void>;
  documentType: string;
  label: string;
  existingFile?: { fileName: string; status: string } | null;
  disabled?: boolean;
}

export default function DocumentUploader({
  onUpload,
  documentType,
  label,
  existingFile,
  disabled = false,
}: DocumentUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setUploading(true);
      setError(null);
      try {
        await onUpload(file, documentType);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [onUpload, documentType]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected: (rejectedFiles: FileRejection[]) => {
      const rejection = rejectedFiles[0]?.errors[0];
      setError(rejection?.code === 'file-too-large'
        ? 'This file is too large. Choose a file up to 5 MB.'
        : rejection?.code === 'too-many-files'
          ? 'Choose one file at a time.'
          : 'Choose a PDF, JPG, or PNG file.');
    },
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    disabled: disabled || uploading,
  });

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-700">
        {label}
        <span className="text-xs text-muted-foreground ml-2">
          ({documentType.replace(/_/g, ' ')})
        </span>
      </label>

      {existingFile ? (
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50">
          {existingFile.status === 'VERIFIED' ? (
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          ) : existingFile.status === 'REJECTED' ? (
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          ) : (
            <FileText className="w-5 h-5 text-blue-500 flex-shrink-0" />
          )}
          <span className="text-sm flex-1 truncate">{existingFile.fileName}</span>
          {!disabled && (
            <div {...getRootProps()}>
              <input {...getInputProps({ 'aria-label': `Replace ${label}` })} />
              <Button variant="outline" size="sm" type="button">
                Replace
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200',
            isDragActive
              ? 'border-primary bg-primary/5'
              : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50',
            (disabled || uploading) && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input {...getInputProps({ 'aria-label': `Upload ${label}` })} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-slate-400" />
              <p className="text-sm text-muted-foreground">
                {isDragActive ? 'Drop file here' : 'Drag & drop or click to upload'}
              </p>
              <p className="text-xs text-slate-400">PDF, JPG, PNG (max 5MB)</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div role="alert" className="flex items-center gap-2 text-sm text-red-500">
          <X className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
