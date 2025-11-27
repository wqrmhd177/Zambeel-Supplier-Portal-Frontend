'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const data = [
  { name: 'Jan', Revenue: 0, Orders: 0 },
  { name: 'Feb', Revenue: 0, Orders: 0 },
  { name: 'Mar', Revenue: 0, Orders: 0 },
  { name: 'Apr', Revenue: 0, Orders: 0 },
  { name: 'May', Revenue: 0, Orders: 0 },
  { name: 'Jun', Revenue: 0, Orders: 0 },
]

export default function RevenueChart() {
  return (
    <div className="bg-white dark:bg-dark-card border border-gray-300 dark:border-gray-800 rounded-2xl p-6 mb-8 transition-colors">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1 text-gray-900 dark:text-white">Revenue Overview</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm">Your monthly performance metrics</p>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a1f2e" />
          <XAxis 
            dataKey="name" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#0f1421',
              border: '1px solid #1a1f2e',
              borderRadius: '8px',
              color: '#fff',
            }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />
          <Line 
            type="monotone" 
            dataKey="Revenue" 
            stroke="#06b6d4" 
            strokeWidth={2}
            dot={{ fill: '#06b6d4', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="Orders" 
            stroke="#a855f7" 
            strokeWidth={2}
            dot={{ fill: '#a855f7', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

