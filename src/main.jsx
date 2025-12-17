import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// import WallSectionDemo from './WallSectionDemo.jsx'
import './App.css'

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service worker registered'))
      .catch(err => console.log('Service worker registration failed:', err))
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
