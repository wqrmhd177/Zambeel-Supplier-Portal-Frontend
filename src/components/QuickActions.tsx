'use client'

import { useRouter } from 'next/navigation'
import { Package, Edit, TrendingUp } from 'lucide-react'

const actions = [
  {
    title: 'Add Products',
    description: 'Start listing your products',
    icon: Package,
    color: 'from-cyan-500 to-blue-500',
    path: '/products/new',
  },
  {
    title: 'Edit Profile',
    description: 'Update your information',
    icon: Edit,
    color: 'from-purple-500 to-pink-500',
    path: '/profile',
  },
  {
    title: 'View Analytics',
    description: 'Check your performance',
    icon: TrendingUp,
    color: 'from-emerald-500 to-green-500',
    path: '/dashboard',
  },
]

export default function QuickActions() {
  const router = useRouter()

  return (
    <div>
      <h2 className="text-xl font-bold mb-6 theme-heading-gradient">Quick Actions</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {actions.map((action, index) => {
          const Icon = action.icon
          
          return (
            <button
              key={index}
              onClick={() => router.push(action.path)}
              className="theme-card rounded-2xl p-6 transition-all text-left group hover:shadow-lg"
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-md`}>
                <Icon className="w-7 h-7 text-white" />
              </div>
              
              <h3 className="text-lg font-bold mb-1 theme-heading">{action.title}</h3>
              <p className="theme-muted text-sm">{action.description}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

