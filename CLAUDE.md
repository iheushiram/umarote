# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Japanese horse racing data visualization application called "umarote" built with React, TypeScript, and Vite. The application displays horse racing information including horse profiles, race results, and provides detailed views of individual horses.

## Development Commands

- **Start development server**: `npm run dev` - Runs Vite development server with auto-open browser
- **Build for production**: `npm run build` - TypeScript compilation followed by Vite build
- **Lint code**: `npm run lint` - ESLint with TypeScript support
- **Preview production build**: `npm run preview` - Preview built application locally
- **Database schema generation**: `npm run db:generate` - Generate Drizzle migrations
- **Database migration**: `npm run db:migrate` - Apply migrations to database
- **Database studio**: `npm run db:studio` - Open Drizzle Studio for database management

## Architecture

The application follows a modern React architecture with:

### State Management
- **Zustand** (`src/store/horseStore.ts`) - Global state for horses and selected horse
- **TanStack Query** - Server state management and caching (configured in `src/App.tsx`)

### Routing
- **React Router DOM** - Client-side routing with main routes:
  - `/` - Main horse racing table view (`TopPage` component)
  - `/horse/:id` - Individual horse detail view (`HorseDetail` page)
  - `/admin` - Admin page for CSV upload and data management (`AdminPage`)

### UI Framework
- **Material-UI** - Primary UI component library with custom theme
- **Emotion** - CSS-in-JS styling (peer dependency of MUI)
- **Framer Motion** - Animation library
- **Lucide React** - Additional icon library

### Data Structure
Key TypeScript interfaces in `src/types/horse.ts`:
- `Horse` - Base horse information (name, birth year, pedigree, etc.)
- `RaceResult` - Individual race performance data
- `HorseWithResults` - Combined horse and race results

### Component Architecture
- `src/pages/` - Page-level components for routing
- `src/components/` - Reusable components including:
  - `HorseRacingTable.tsx` - Main table display
  - `HorseTable.tsx` - Tabular horse data
  - `ui/` - Shared UI components (table, select)

### Services
- `src/services/horseService.ts` - Currently returns sample data, designed for future API integration
- `src/services/adminService.ts` - Database operations for admin functionality

### Database
- **Drizzle ORM** - Type-safe SQL ORM for database operations
- **Cloudflare D1** - SQLite-based serverless database (with local development support)
- Schema defined in `src/db/schema.ts` with tables for horses, races, race results, and race entries
- Local development uses better-sqlite3 with mock service for browser compatibility

## Path Configuration

TypeScript path aliases configured:
- `@/*` maps to `src/*`
- `~/*` maps to `public/*`

## Japanese Localization

The application uses Japanese text and terminology:
- Horse sex values: '牡' (stallion), '牝' (mare), 'セ' (gelding)
- Course types: '芝' (turf), 'ダート' (dirt)
- All UI text and data labels are in Japanese

## Development Notes

- The project uses Vite with React and TypeScript
- Path resolution is configured via `vite-tsconfig-paths` plugin
- Sample horse data includes famous Japanese racehorses (ディープインパクト, オルフェーヴル)
- The data service is currently mock-based but structured for easy API integration

## Admin Features

- Admin page accessible at `/admin` for data management
- CSV upload functionality for:
  - Horse information (馬情報)
  - Race information (レース情報) 
  - Race results (レース結果)
- Data validation and preview before database insertion
- Mock service stores data in localStorage for local development
- Full database integration ready for Cloudflare D1 deployment