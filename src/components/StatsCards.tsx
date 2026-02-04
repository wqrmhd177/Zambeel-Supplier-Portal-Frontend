'use client'

import { Package, ShoppingCart, DollarSign, TrendingUp } from 'lucide-react'

const stats = [
  {
    title: 'Total Products',
    value: '0',
    subtitle: 'Start selling products',
    icon: Package,
    color: 'from-cyan-500 to-blue-500',
  },
  {
    title: 'Active Orders',
    value: '0',
    subtitle: 'No orders yet',
    icon: ShoppingCart,
    color: 'from-emerald-500 to-green-500',
  },
  {
    title: 'Total Revenue',
    value: 'PKR 0',
    subtitle: 'This month',
    icon: DollarSign,
    color: 'from-purple-500 to-pink-500',
  },
  {
    title: 'Growth',
    value: '0%',
    subtitle: 'vs. last month',
    icon: TrendingUp,
    color: 'from-orange-500 to-yellow-500',
  },
]

export default function StatsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        
        return (
          <div
            key={index}
            className="theme-card rounded-2xl p-6 transition-all hover:shadow-lg"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="theme-label text-sm mb-1">{stat.title}</p>
                <h3 className="text-3xl font-bold theme-heading">{stat.value}</h3>
                <p className="theme-muted text-xs mt-1">{stat.subtitle}</p>
              </div>
              
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center shadow-md`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

