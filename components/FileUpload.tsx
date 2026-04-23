'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onUploadSuccess: (surveyId: string, fileName: string, totalContacts: number) => void;
  isLoading?: boolean;
}

export function FileUpload({ onUploadSuccess, isLoading = false }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileSelect = async (file: File) => {
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx?|csv)$/i)) {
      setUploadError('Please upload a valid Excel or CSV file (.xlsx, .xls, or .csv)');
      return;
    }

    setSelectedFileName(file.name);
    setUploadError(null);
    setUploadSuccess(false);

    // Upload file
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const backendUrl = 
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      'https://call-agent-envo.onrender.com';
      const response = await fetch(`${backendUrl}/api/surveys/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();
      
      if (data.success) {
        setUploadSuccess(true);
        setUploadError(null);
        onUploadSuccess(data.survey.id, data.survey.fileName, data.survey.totalContacts);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed. Please try again.';
      setUploadError(errorMessage);
      setUploadSuccess(false);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Upload Survey File</CardTitle>
        <CardDescription>
          Upload an Excel or CSV file with contact information (Name in first column, Phone in second column)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Drag and Drop Area */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleInputChange}
              className="hidden"
              disabled={isUploading || isLoading}
            />
            
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="text-sm font-medium">
                {isUploading ? 'Uploading...' : 'Drag and drop your file here'}
              </p>
              <p className="text-xs text-gray-500">
                or
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isLoading}
              >
                Browse Files
              </Button>
            </div>
          </div>

          {/* Selected File Display */}
          {selectedFileName && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-gray-700">{selectedFileName}</span>
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {uploadSuccess && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                File uploaded successfully! Your survey is ready to begin calling.
              </AlertDescription>
            </Alert>
          )}

          {/* Format Instructions */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-xs font-semibold text-blue-900 mb-2">File Format Requirements:</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Column A: Contact Name</li>
              <li>• Column B: Phone Number (10-15 digits)</li>
              <li>• Supported formats: .xlsx, .xls, .csv</li>
              <li>• Minimum 1 contact required</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
