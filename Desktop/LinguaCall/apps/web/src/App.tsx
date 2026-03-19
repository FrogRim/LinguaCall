import { Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import ScreenLogin from './pages/ScreenLogin';
import ScreenVerify from './pages/ScreenVerify';
import ScreenSession from './pages/ScreenSession';
import ScreenBilling from './pages/ScreenBilling';
import ScreenReport from './pages/ScreenReport';

export default function App() {
  return (
    <UserProvider>
      <Routes>
        <Route path="/" element={<ScreenLogin />} />
        <Route path="/verify" element={<ScreenVerify />} />
        <Route path="/session" element={<ScreenSession />} />
        <Route path="/billing" element={<ScreenBilling />} />
        <Route path="/report/:reportId" element={<ScreenReport />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </UserProvider>
  );
}
