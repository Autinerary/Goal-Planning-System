'use client'

import { useState } from 'react'
import Link from 'next/link'
import { 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Eye,
  Filter,
  MoreVertical
} from 'lucide-react'
import type { Resource } from '@/types/database'

interface ResourceTableProps {
  resources: Resource[]
  onEdit?: (resource: Resource) => void
  onDelete?: (resourceId: string) => void
  onApprove?: (resourceId: string) => void
  onReject?: (resourceId: string) => void
  loading?: boolean
}

export default function ResourceTable({
  resources,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  loading = false,
}: ResourceTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(resources.map((r) => r.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(id)
    } else {
      newSelected.delete(id)
    }
    setSelectedIds(newSelected)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (resources.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Filter className="w-12 h-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
        <p>No resources found</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.size} resource{selectedIds.size === 1 ? '' : 's'} selected
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                selectedIds.forEach((id) => onApprove?.(id))
                setSelectedIds(new Set())
              }}
              className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
            >
              Approve Selected
            </button>
            <button
              onClick={() => {
                selectedIds.forEach((id) => onDelete?.(id))
                setSelectedIds(new Set())
              }}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === resources.length && resources.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resource
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {resources.map((resource) => (
                <tr key={resource.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(resource.id)}
                      onChange={(e) => handleSelect(resource.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div>
                        <Link
                          href={`/resources/${resource.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600"
                        >
                          {resource.name}
                        </Link>
                        <div className="text-sm text-gray-500 truncate max-w-md">
                          {resource.description?.substring(0, 100)}
                          {resource.description && resource.description.length > 100 && '...'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full capitalize">
                      {resource.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        resource.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : resource.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {resource.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {resource.created_at
                      ? new Date(resource.created_at).toLocaleDateString()
                      : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/resources/${resource.id}`}
                        className="text-blue-600 hover:text-blue-900"
                        title="View"
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      </Link>
                      {onEdit && (
                        <button
                          onClick={() => onEdit(resource)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      {resource.status === 'pending' && onApprove && (
                        <button
                          onClick={() => onApprove(resource.id)}
                          className="text-green-600 hover:text-green-900"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      {resource.status !== 'approved' && onReject && (
                        <button
                          onClick={() => onReject(resource.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Reject"
                        >
                          <XCircle className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(resource.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}