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
    <div className="theme-card rounded-2xl p-6 mb-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold mb-1 theme-heading">Revenue Overview</h2>
        <p className="theme-muted text-sm">Your monthly performance metrics</p>
      </div>
      
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.15)" />
          <XAxis 
            dataKey="name" 
            stroke="rgba(255,255,255,0.7)"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="rgba(255,255,255,0.7)"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#1e1b4b',
              border: '1px solid rgba(255,255,255,0.15)',
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
            stroke="#22d3ee" 
            strokeWidth={2}
            dot={{ fill: '#22d3ee', r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="Orders" 
            stroke="#a78bfa" 
            strokeWidth={2}
            dot={{ fill: '#a78bfa', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

