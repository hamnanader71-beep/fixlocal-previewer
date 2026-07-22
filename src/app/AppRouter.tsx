import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { AuthLayout } from "./layout/AuthLayout";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth } from "./auth/RequireAuth";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import DashboardPage from "./pages/DashboardPage";
import LeadsPage from "./pages/LeadsPage";
import LeadHunterPage from "./pages/LeadHunterPage";
import ContractorHunterPage from "./pages/ContractorHunterPage";
import LeadDetailPage from "./pages/LeadDetailPage";
import NewLeadPage from "./pages/NewLeadPage";
import OrganizationsPage from "./pages/OrganizationsPage";
import CompaniesPage from "./pages/CompaniesPage";
import CompanyDetailPage from "./pages/CompanyDetailPage";
import ContactsPage from "./pages/ContactsPage";
import ContactDetailPage from "./pages/ContactDetailPage";
import DealsPage from "./pages/DealsPage";
import DealDetailPage from "./pages/DealDetailPage";
import InboxPage from "./pages/InboxPage";
import UsersPage from "./pages/UsersPage";
import CountriesPage from "./pages/CountriesPage";
import StatesPage from "./pages/StatesPage";
import CitiesPage from "./pages/CitiesPage";
import ServiceCategoriesPage from "./pages/ServiceCategoriesPage";
import LeadSourcesPage from "./pages/LeadSourcesPage";
import MarketplacePage from "./pages/MarketplacePage";
import ContractorsPage from "./pages/ContractorsPage";
import SettingsPage from "./pages/SettingsPage";
import PartnerHunterPage from "./pages/PartnerHunterPage";
import CampaignsPage from "./pages/CampaignsPage";
import InvoicesPage from "./pages/InvoicesPage";
import IntegrationsPage from "./pages/IntegrationsPage";
import TasksPage from "./pages/TasksPage";
import NotFoundPage from "./pages/NotFoundPage";

export function AppRouter() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
          </Route>
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/hunter" element={<LeadHunterPage />} />
            <Route path="/hunter/contractors" element={<ContractorHunterPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/leads/new" element={<NewLeadPage />} />
            <Route path="/leads/:id" element={<LeadDetailPage />} />
            <Route path="/contacts" element={<ContactsPage />} />
            <Route path="/contacts/:id" element={<ContactDetailPage />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/companies/:id" element={<CompanyDetailPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/deals/:id" element={<DealDetailPage />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/contractors" element={<ContractorsPage />} />
            <Route path="/organizations" element={<OrganizationsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/admin/countries" element={<CountriesPage />} />
            <Route path="/admin/states" element={<StatesPage />} />
            <Route path="/admin/cities" element={<CitiesPage />} />
            <Route path="/admin/service-categories" element={<ServiceCategoriesPage />} />
            <Route path="/admin/lead-sources" element={<LeadSourcesPage />} />
            <Route path="/partners" element={<PartnerHunterPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/invoices" element={<InvoicesPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AuthProvider>
  );
}
