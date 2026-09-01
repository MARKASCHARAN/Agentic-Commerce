import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Overview from './pages/Overview';
import AgentFactory from './pages/AgentFactory';
import MakeStoreReady from './pages/MakeStoreReady';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<DashboardLayout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="factory" element={<AgentFactory />} />
          <Route path="ai-ready" element={<MakeStoreReady />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
