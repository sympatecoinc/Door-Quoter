'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { Customer, Contact, CustomerFile, CUSTOMER_STATUS_CONFIG } from '@/types/customer'
import CustomerForm from './CustomerForm'
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  Star,
  X,
  Save,
  Loader2,
  FileText,
  Upload,
  Download,
  File,
  Image as ImageIcon,
  FileSpreadsheet,
  ClipboardList,
  Receipt
} from 'lucide-react'

type Tab = 'info' | 'contacts' | 'salesOrders' | 'invoices' | 'files'

function DetailSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="p-6 animate-pulse">
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Customers
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gray-200 rounded-xl" />
            <div className="space-y-2">
              <div className="h-7 w-48 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
        <div className="h-10 w-20 bg-gray-200 rounded-lg" />
      </div>
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 w-20 bg-gray-200 rounded mb-3" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6].map((j) => (
                <div key={j} className="flex justify-between">
                  <div className="h-4 w-24 bg-gray-100 rounded" />
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return FileSpreadsheet
  if (mimeType.includes('pdf')) return FileText
  return File
}

export default function CustomerDetailView() {
  const { selectedCustomerId, setSelectedCustomerId } = useAppStore()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [showEditForm, setShowEditForm] = useState(false)

  // Contact form state
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [contactFormData, setContactFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    title: '',
    isPrimary: false
  })
  const [savingContact, setSavingContact] = useState(false)

  // Files state
  const [files, setFiles] = useState<(CustomerFile & { url: string })[]>([])
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Sales orders and invoices
  const [salesOrders, setSalesOrders] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  // Contacts state
  const [contacts, setContacts] = useState<Contact[]>([])

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomer()
    }
  }, [selectedCustomerId])

  useEffect(() => {
    if (customer && activeTab === 'contacts') {
      fetchContacts()
    }
    if (customer && activeTab === 'files') {
      fetchFiles()
    }
    if (customer && activeTab === 'salesOrders') {
      fetchSalesOrders()
    }
    if (customer && activeTab === 'invoices') {
      fetchInvoices()
    }
  }, [customer, activeTab])

  async function fetchCustomer() {
    setLoading(true)
    try {
      const response = await fetch(`/api/customers/${selectedCustomerId}`)
      if (response.ok) {
        const data = await response.json()
        setCustomer(data)
        if (data.contacts) {
          setContacts(data.contacts)
        }
      }
    } catch (error) {
      console.error('Error fetching customer:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchContacts() {
    try {
      const response = await fetch(`/api/customers/${selectedCustomerId}/contacts`)
      if (response.ok) {
        const data = await response.json()
        setContacts(data)
      }
    } catch (error) {
      console.error('Error fetching contacts:', error)
    }
  }

  async function fetchFiles() {
    try {
      const response = await fetch(`/api/customers/${selectedCustomerId}/files`)
      if (response.ok) {
        const data = await response.json()
        setFiles(data)
      }
    } catch (error) {
      console.error('Error fetching files:', error)
    }
  }

  async function fetchSalesOrders() {
    setLoadingOrders(true)
    try {
      const response = await fetch(`/api/sales-orders?customerId=${selectedCustomerId}`)
      if (response.ok) {
        const data = await response.json()
        setSalesOrders(data.salesOrders || [])
      }
    } catch (error) {
      console.error('Error fetching sales orders:', error)
    } finally {
      setLoadingOrders(false)
    }
  }

  async function fetchInvoices() {
    setLoadingInvoices(true)
    try {
      const response = await fetch(`/api/invoices?customerId=${selectedCustomerId}`)
      if (response.ok) {
        const data = await response.json()
        setInvoices(data.invoices || [])
      }
    } catch (error) {
      console.error('Error fetching invoices:', error)
    } finally {
      setLoadingInvoices(false)
    }
  }

  function handleBack() {
    setSelectedCustomerId(null)
  }

  function openContactForm(contact?: Contact) {
    if (contact) {
      setEditingContact(contact)
      setContactFormData({
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email || '',
        phone: contact.phone || '',
        title: contact.title || '',
        isPrimary: contact.isPrimary
      })
    } else {
      setEditingContact(null)
      setContactFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        title: '',
        isPrimary: false
      })
    }
    setShowContactForm(true)
  }

  async function handleSaveContact(e: React.FormEvent) {
    e.preventDefault()
    if (!customer || !contactFormData.firstName.trim() || !contactFormData.lastName.trim()) return

    setSavingContact(true)
    try {
      const url = editingContact
        ? `/api/customers/${customer.id}/contacts/${editingContact.id}`
        : `/api/customers/${customer.id}/contacts`

      const response = await fetch(url, {
        method: editingContact ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactFormData)
      })

      if (response.ok) {
        setShowContactForm(false)
        await fetchContacts()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to save contact')
      }
    } catch (error) {
      console.error('Error saving contact:', error)
      alert('Failed to save contact')
    } finally {
      setSavingContact(false)
    }
  }

  async function handleDeleteContact(contact: Contact) {
    if (!customer || !confirm(`Delete contact "${contact.firstName} ${contact.lastName}"?`)) return

    try {
      const response = await fetch(`/api/customers/${customer.id}/contacts/${contact.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchContacts()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete contact')
      }
    } catch (error) {
      console.error('Error deleting contact:', error)
      alert('Failed to delete contact')
    }
  }

  // File upload handlers
  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      await uploadFiles(droppedFiles)
    }
  }, [selectedCustomerId])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    if (selectedFiles.length > 0) {
      await uploadFiles(selectedFiles)
    }
    e.target.value = ''
  }

  async function uploadFiles(filesToUpload: File[]) {
    if (!selectedCustomerId) return

    setUploading(true)
    try {
      const formData = new FormData()
      filesToUpload.forEach(file => formData.append('files', file))

      const response = await fetch(`/api/customers/${selectedCustomerId}/files`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        await fetchFiles()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to upload files')
      }
    } catch (error) {
      console.error('Error uploading files:', error)
      alert('Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeleteFile(fileId: number) {
    if (!confirm('Delete this file?')) return

    try {
      const response = await fetch(`/api/customers/${selectedCustomerId}/files/${fileId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchFiles()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to delete file')
      }
    } catch (error) {
      console.error('Error deleting file:', error)
      alert('Failed to delete file')
    }
  }

  function handleEditFormSave() {
    setShowEditForm(false)
    fetchCustomer()
  }

  if (loading) {
    return <DetailSkeleton onBack={handleBack} />
  }

  if (!customer) {
    return (
      <div className="p-6">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Customers
        </button>
        <div className="text-center text-gray-500 py-8">Customer not found</div>
      </div>
    )
  }

  const statusConfig = CUSTOMER_STATUS_CONFIG[customer.status as keyof typeof CUSTOMER_STATUS_CONFIG] || {
    label: customer.status,
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600'
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Customers
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{customer.companyName}</h1>
              {customer.contactName && (
                <p className="text-gray-600">{customer.contactName}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                  {statusConfig.label}
                </span>
                {customer.source && (
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                    {customer.source}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowEditForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Edit2 className="w-4 h-4" />
          Edit
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-6">
          {([
            { id: 'info', label: 'Info' },
            { id: 'contacts', label: `Contacts (${contacts.length})` },
            { id: 'salesOrders', label: 'Sales Orders' },
            { id: 'invoices', label: 'Invoices' },
            { id: 'files', label: `Files (${files.length})` }
          ] as { id: Tab; label: string }[]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Information */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Contact Information
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500 min-w-[60px]">Email</span>
                {customer.email ? (
                  <a href={`mailto:${customer.email}`} className="text-blue-600 hover:underline">
                    {customer.email}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-500 min-w-[60px]">Phone</span>
                {customer.phone ? (
                  <a href={`tel:${customer.phone}`} className="text-gray-900">
                    {customer.phone}
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Address
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Address</span>
                <span className="text-gray-900">{customer.address || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">City</span>
                <span className="text-gray-900">{customer.city || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">State</span>
                <span className="text-gray-900">{customer.state || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">ZIP Code</span>
                <span className="text-gray-900">{customer.zipCode || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Country</span>
                <span className="text-gray-900">{customer.country || '-'}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg border border-gray-200 p-5 lg:col-span-2">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Notes</h3>
            {customer.notes ? (
              <p className="text-gray-900 whitespace-pre-wrap">{customer.notes}</p>
            ) : (
              <p className="text-gray-400">No notes</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'contacts' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => openContactForm()}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          </div>

          {contacts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 flex items-center gap-1">
                          {contact.firstName} {contact.lastName}
                          {contact.isPrimary && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {contact.title && (
                          <div className="text-sm text-gray-500">{contact.title}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openContactForm(contact)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    {contact.email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail className="w-3 h-3" />
                        <a href={`mailto:${contact.email}`} className="hover:text-blue-600">
                          {contact.email}
                        </a>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="w-3 h-3" />
                        {contact.phone}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No contacts added yet
            </div>
          )}
        </div>
      )}

      {activeTab === 'salesOrders' && (
        <div className="bg-white rounded-lg border border-gray-200">
          {loadingOrders ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : salesOrders.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {salesOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{order.orderNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        order.status === 'CANCELLED' ? 'bg-red-100 text-red-800' :
                        order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      ${order.totalAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No sales orders found
            </div>
          )}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="bg-white rounded-lg border border-gray-200">
          {loadingInvoices ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : invoices.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{invoice.invoiceNumber}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        invoice.status === 'PAID' ? 'bg-green-100 text-green-800' :
                        invoice.status === 'VOIDED' ? 'bg-red-100 text-red-800' :
                        invoice.status === 'OVERDUE' ? 'bg-orange-100 text-orange-800' :
                        invoice.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      ${invoice.totalAmount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No invoices found
            </div>
          )}
        </div>
      )}

      {activeTab === 'files' && (
        <div>
          {/* Upload Area */}
          <div
            className={`mb-4 border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-gray-600">Uploading...</span>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 mb-2">
                  Drag and drop files here, or{' '}
                  <label className="text-blue-600 hover:underline cursor-pointer">
                    browse
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                </p>
                <p className="text-sm text-gray-400">
                  Upload documents, images, or other files
                </p>
              </>
            )}
          </div>

          {/* File List */}
          {files.length > 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
              {files.map((file) => {
                const FileIcon = getFileIcon(file.mimeType)
                return (
                  <div key={file.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileIcon className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{file.originalName}</div>
                        <div className="text-sm text-gray-500">
                          {formatFileSize(file.size)} • {new Date(file.createdAt).toLocaleDateString()}
                          {file.uploadedBy && ` • ${file.uploadedBy}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={file.url}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-gray-100 rounded"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No files uploaded yet
            </div>
          )}
        </div>
      )}

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingContact ? 'Edit Contact' : 'Add Contact'}
              </h3>
              <button
                onClick={() => setShowContactForm(false)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveContact} className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactFormData.firstName}
                    onChange={(e) => setContactFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={contactFormData.lastName}
                    onChange={(e) => setContactFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Title</label>
                <input
                  type="text"
                  value={contactFormData.title}
                  onChange={(e) => setContactFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Project Manager"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={contactFormData.email}
                  onChange={(e) => setContactFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Phone</label>
                <input
                  type="tel"
                  value={contactFormData.phone}
                  onChange={(e) => setContactFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contactFormData.isPrimary}
                  onChange={(e) => setContactFormData(prev => ({ ...prev, isPrimary: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">Primary contact</span>
              </label>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowContactForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingContact}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingContact ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Form Modal */}
      {showEditForm && (
        <CustomerForm
          customer={customer}
          onClose={() => setShowEditForm(false)}
          onSave={handleEditFormSave}
        />
      )}
    </div>
  )
}
