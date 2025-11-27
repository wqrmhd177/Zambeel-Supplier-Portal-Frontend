# SupplierHub - Supplier Portal Frontend

A modern, beautiful supplier management portal built with Next.js, TypeScript, and Tailwind CSS.

## Features

- 📊 Dashboard with real-time statistics
- 📈 Revenue overview with interactive charts
- 👤 Supplier profile management
- 🎨 Modern dark theme UI
- 📱 Fully responsive design
- ⚡ Built with Next.js 14 for optimal performance

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Supabase account and project

### Installation

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file in the frontend directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace the values with your actual Supabase credentials from your Supabase project settings.

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file (this file is gitignored and should not be committed):

- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous/public key

## Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Icons**: Lucide React

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── components/
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       ├── StatsCards.tsx
│       ├── RevenueChart.tsx
│       ├── SupplierProfile.tsx
│       └── QuickActions.tsx
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## License

MIT

