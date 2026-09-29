import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

async function boot(): Promise<void> {
  // Outside Electron (plain browser during UI work) there is no preload bridge; use a fake one.
  if (import.meta.env.DEV && !('launcher' in window)) {
    const { installMockLauncher } = await import('./dev/mockLauncher')
    installMockLauncher()
  }
  const { App } = await import('./App')
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}

void boot()
