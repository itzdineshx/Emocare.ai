/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LiveMonitor from './pages/LiveMonitor';
import Insights from './pages/Insights';
import Notifications from './pages/Notifications';
import AICompanion from './pages/AICompanion';
import Settings from './pages/Settings';
import { LanguageProvider } from './lib/language-context';
import { AuthProvider } from './lib/auth-context';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="monitor" element={<LiveMonitor />} />
              <Route path="insights" element={<Insights />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="companion" element={<AICompanion />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

