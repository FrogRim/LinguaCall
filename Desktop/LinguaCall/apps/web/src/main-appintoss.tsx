import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import AppInToss from './AppInToss';
import './styles.css';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <HashRouter>
      <AppInToss />
    </HashRouter>
  </React.StrictMode>
);
