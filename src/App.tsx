import { createHashRouter, RouterProvider } from 'react-router';
import { AppLayout } from './components/layout/AppLayout';
import ErrorPage from './pages/ErrorPage';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Projects from './pages/Projects';
import Invoices from './pages/Invoices';
import InvoiceForm from './pages/InvoiceForm';
import InvoiceDetail from './pages/InvoiceDetail';
import Expenses from './pages/Expenses';
import Time from './pages/Time';
import Proposals from './pages/Proposals';
import ProposalForm from './pages/ProposalForm';
import ProposalDetail from './pages/ProposalDetail';
import Documents from './pages/Documents';
import DocumentEditor from './pages/DocumentEditor';
import Toolbox from './pages/Toolbox';
import Settings from './pages/Settings';

const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'clients', element: <Clients /> },
      { path: 'clients/:id', element: <ClientDetail /> },
      { path: 'projects', element: <Projects /> },
      { path: 'invoices', element: <Invoices /> },
      { path: 'invoices/new', element: <InvoiceForm /> },
      { path: 'invoices/:id', element: <InvoiceDetail /> },
      { path: 'invoices/:id/edit', element: <InvoiceForm /> },
      { path: 'expenses', element: <Expenses /> },
      { path: 'time', element: <Time /> },
      { path: 'proposals', element: <Proposals /> },
      { path: 'proposals/new', element: <ProposalForm /> },
      { path: 'proposals/:id', element: <ProposalDetail /> },
      { path: 'proposals/:id/edit', element: <ProposalForm /> },
      { path: 'documents', element: <Documents /> },
      { path: 'documents/new', element: <DocumentEditor /> },
      { path: 'documents/:id/edit', element: <DocumentEditor /> },
      { path: 'toolbox', element: <Toolbox /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
