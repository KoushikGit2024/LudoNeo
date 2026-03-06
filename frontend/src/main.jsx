// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './main.css'
// import App from './App.jsx'
// import { BrowserRouter } from 'react-router-dom'
// import { ToastContainer } from 'react-toastify'
// import { AudioProvider } from './contexts/SoundContext'

// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//   <AudioProvider>
//     <BrowserRouter>
//       <App />
//     </BrowserRouter>
//   </AudioProvider>
//   </StrictMode>
//   ,
// )
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './main.css'
import App from './App.jsx'
import { AudioProvider } from './contexts/SoundContext'

createRoot(document.getElementById('root')).render(
  <>
    {/* AudioProvider wraps the entire app to manage 
      global SFX and Music state across all pages.
    */}
    <AudioProvider>
      <App />
    </AudioProvider>
  </>
)