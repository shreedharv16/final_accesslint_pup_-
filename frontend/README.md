# AccessLint Frontend

This is the frontend application for AccessLint - a React + TypeScript + Tailwind CSS application for user authentication and VSIX download.

## Features

- User registration and login
- JWT-based authentication with automatic token refresh
- VSIX file download from Azure Blob Storage
- Usage statistics and rate limit display
- Responsive and accessible UI

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from template:
```bash
cp .env.template .env
```

3. Update `.env` with your backend API URL:
```
VITE_API_URL=http://localhost:3000/api
```

### Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3001`

### Build

Build for production:
```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable React components
│   ├── context/         # React Context (Auth)
│   ├── pages/           # Page components
│   ├── services/        # API services
│   ├── App.tsx          # Main App component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles + Tailwind
├── public/              # Static assets
├── index.html           # HTML template
├── vite.config.ts       # Vite configuration
├── tailwind.config.js   # Tailwind CSS configuration
└── tsconfig.json        # TypeScript configuration
```

## Deployment

### Azure Static Web Apps

1. Build the application:
```bash
npm run build
```

2. Deploy the `dist` directory to Azure Static Web Apps

3. Configure environment variables in Azure:
   - `VITE_API_URL`: Your backend API URL

## Technologies Used

- **React 18**: UI library
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **Tailwind CSS**: Utility-first CSS framework
- **React Router**: Client-side routing
- **Axios**: HTTP client with interceptors

