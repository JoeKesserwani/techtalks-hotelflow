'use client'

import React, { useEffect, useState } from 'react'
import Sidebar from '../Navbars/navbar'

type AuditLog = {
  id: string
  action: string
  entityType: string
  createdAt: string
  user: { fullName: string } | null
}

export default function ActivityLogDash() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/audit-logs')
      .then((res) => res.json())
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex h-screen w-full bg-[#F5F0E4]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-10 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Activity log</h1>
        <p className="text-sm text-gray-500 mb-6">Recent actions across the system</p>

        <div className="bg-white rounded-md border border-gray-200 divide-y divide-gray-200 max-w-3xl">
          {loading && <div className="p-4 text-sm text-gray-500">Loading...</div>}
          {!loading && logs.length === 0 && (
            <div className="p-4 text-sm text-gray-500">No activity yet.</div>
          )}
          {logs.map((log) => (
            <div key={log.id} className="p-4 flex items-start gap-3">
              <span className="mt-1 w-2 h-2 rounded-full bg-[#C1633B] flex-shrink-0" />
              <div>
                <div className="text-sm text-gray-900">
                  <span className="font-medium">{log.user?.fullName || 'Unknown staff'}</span>{' '}
                  {log.action} {log.entityType}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}