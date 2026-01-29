# Zambeel Supplier Portal - Frontend

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

### Installation

1. Navigate to the frontend directory:

```bash
cd frontend
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

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

