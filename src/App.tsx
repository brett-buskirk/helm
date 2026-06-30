import { createHashRouter, RouterProvider } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Projects from './pages/Projects';
import Invoices from './pages/Invoices';
import Expenses from './pages/Expenses';
import Documents from './pages/Documents';
import Settings from './pages/Settings';

const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'clients', element: <Clients /> },
      { path: 'clients/:id', element: <ClientDetail /> },
      { path: 'projects', element: <Projects /> },
      { path: 'invoices', element: <Invoices /> },
      { path: 'expenses', element: <Expenses /> },
      { path: 'documents', element: <Documents /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
