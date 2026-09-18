import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import AdminApp from './features/admin/AdminApp.jsx';
import './index.css';

const isAdminRoute = window.location.pathname.startsWith('/admin');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdminRoute ? <AdminApp /> : <App />}
  </React.StrictMode>
);
