import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BranchProvider } from './context/BranchContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BranchProvider>
      <App />
    </BranchProvider>
  </StrictMode>,
)
