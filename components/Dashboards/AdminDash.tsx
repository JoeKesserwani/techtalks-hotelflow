import React from 'react'
import Sidebar from '../Navbars/navbar'
import { TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

// Sample data — replace with real data fetched from your database
const revenueData = [
  { month: 'Apr', revenue: 18200 },
  { month: 'May', revenue: 21400 },
  { month: 'Jun', revenue: 24800 },
  { month: 'Jul', revenue: 31200 },
  { month: 'Aug', revenue: 29500 },
  { month: 'Sep', revenue: 26100 },
]

const customersData = [
  { month: 'Apr', customers: 142 },
  { month: 'May', customers: 168 },
  { month: 'Jun', customers: 191 },
  { month: 'Jul', customers: 233 },
  { month: 'Aug', customers: 219 },
  { month: 'Sep', customers: 197 },
]

function StatCard({ label, value, sublabel }: { label: string; value: string; sublabel: string }) {
  return (
    <div className="rounded-md p-5 bg-white border border-gray-200 flex flex-col gap-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-3xl font-semibold text-gray-900">{value}</span>
      <span className="text-xs text-gray-500">{sublabel}</span>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md p-5 bg-white border border-gray-200">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-gray-900">
        <TrendingUp size={15} className="text-orange-600" />
        {title}
      </h2>
      <div style={{ width: '100%', height: 220 }}>{children}</div>
    </div>
  )
}

const AdminDash = () => {
  return (
    <div className="flex h-screen w-full bg-gray-50">
      <Sidebar />

      <main className="flex-1 overflow-y-auto px-10 py-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Hotel Analytics</h1>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard
            label="Revenue (this month)"
            value={`$${revenueData[revenueData.length - 1].revenue.toLocaleString()}`}
            sublabel="vs last month"
          />
          <StatCard
            label="Customers visited"
            value={`${customersData[customersData.length - 1].customers}`}
            sublabel="vs last month"
          />
          <StatCard
            label="Avg. revenue / guest"
            value={`$${Math.round(
              revenueData[revenueData.length - 1].revenue /
                customersData[customersData.length - 1].customers
            )}`}
            sublabel="6 month trailing"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <ChartCard title="Revenue per month">
            <ResponsiveContainer>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#C1633B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Customers visited per month">
            <ResponsiveContainer>
              <LineChart data={customersData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="customers"
                  stroke="#93A382"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </main>
    </div>
  )
}

export default AdminDash
