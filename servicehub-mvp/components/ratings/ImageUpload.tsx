'use client'

import { useState, useRef } from 'react'
import { X, Upload, Image as ImageIcon } from 'lucide-react'
import imageCompression from 'browser-image-compression'

interface ImageUploadProps {
  images: File[]
  onChange: (images: File[]) => void
  maxImages?: number
  maxSizeKB?: number
}

export default function ImageUpload({
  images,
  onChange,
  maxImages = 2,
  maxSizeKB = 500,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const compressImage = async (file: File): Promise<File> => {
    const options = {
      maxSizeMB: maxSizeKB / 1000,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
    }

    try {
      const compressedFile = await imageCompression(file, options)
      return compressedFile
    } catch (error) {
      console.error('Error compressing image:', error)
      throw new Error('Failed to compress image')
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setError('')

    if (images.length + files.length > maxImages) {
      setError(`You can only upload up to ${maxImages} images`)
      return
    }

    setUploading(true)

    try {
      const compressedFiles: File[] = []
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          setError(`${file.name} is not an image file`)
          continue
        }

        try {
          const compressed = await compressImage(file)
          compressedFiles.push(compressed)
        } catch (error) {
          setError(`Failed to compress ${file.name}. Please try a different image.`)
          continue
        }
      }

      if (compressedFiles.length > 0) {
        onChange([...images, ...compressedFiles])
      }
    } catch (error: any) {
      setError(error.message || 'Failed to process images')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index)
    onChange(newImages)
    setError('')
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-900">
        Photos <span className="text-gray-500 text-xs">(Optional, max {maxImages})</span>
      </label>

      <div className="space-y-3">
        {/* Upload Button */}
        {images.length < maxImages && (
          <button
            type="button"
            onClick={handleClick}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium text-gray-700">Processing...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-gray-400" aria-hidden="true" />
                <span className="text-sm font-medium text-gray-700">
                  Upload Photos ({images.length}/{maxImages})
                </span>
              </>
            )}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading || images.length >= maxImages}
        />

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Image Preview */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {images.map((image, index) => (
              <div key={index} className="relative group">
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={URL.createObjectURL(image)}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label={`Remove image ${index + 1}`}
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="mt-1 text-xs text-gray-500 text-center">
                  {(image.size / 1024).toFixed(1)} KB
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Helper Text */}
        <p className="text-xs text-gray-500">
          Images will be compressed to max {maxSizeKB}KB each. Supported formats: JPG, PNG, WebP
        </p>
      </div>
    </div>
  )
}