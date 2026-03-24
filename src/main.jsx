import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { GuildProvider } from './context/GuildContext';
import * as constants from './utils/constants';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GuildProvider initialData={constants}>
      <App />
    </GuildProvider>
  </React.StrictMode>
)