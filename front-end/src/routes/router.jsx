import { createBrowserRouter, Navigate } from "react-router-dom";
import MainLayout from "../layouts/MainLayout";
import ProtectedRoute from "./ProtectedRoute";

import Counter from "../pages/Counter";
import Customers from "../pages/Customers";
import Dashboard from "../pages/dashboard";
import FirstConnexionPassword from "../pages/FirstConnexionPassword";
import ForgotPassword from "../pages/ForgotPassword";
import Help from "../pages/Help";
import Login from "../pages/Login";
import Logout from "../pages/Logout";
import Messages from "../pages/Messages";
import Orders from "../pages/Orders";
import Operations from "../pages/Operations";
import Payments from "../pages/Payments";
import Profile from "../pages/Profile";
import Products from "../pages/Products";
import RequisitionCreate from "../pages/RequisitionCreate";
import Requisitions from "../pages/Requisitions";
import Reports from "../pages/Reports";
import ReportsSalesTable from "../pages/ReportsSalesTable";
import ReportsSupplyTable from "../pages/ReportsSupplyTable";
import Notifications from "../pages/Notifications";
import Sales from "../pages/Sales";
import Settings from "../pages/Settings";
import Transfers from "../pages/Transfers";
import Deliveries from "../pages/Deliveries";
import Receptions from "../pages/Receptions";
import Inventory from "../pages/Inventory";

const publicRoutes = [
  { path: "/login", element: <Login /> },
  { path: "/forgot-password", element: <ForgotPassword /> },
  { path: "/first-connexion-password", element: <FirstConnexionPassword /> },
];

const protectedRoutes = [
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <MainLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: "dashboard", element: <Dashboard /> },
          { path: "counter", element: <Counter /> },
          { path: "customers", element: <Customers /> },
          { path: "orders", element: <Orders /> },
          { path: "payments", element: <Payments /> },
          { path: "products", element: <Products /> },
          {
            path: "operations",
            element: <Operations />,
            children: [
              { index: true, element: <Navigate to="requisitions" replace /> },
              { path: "requisitions", element: <Requisitions /> },
              { path: "requisitions/nouvelle", element: <RequisitionCreate /> },
              { path: "requisitions/:id/modifier", element: <RequisitionCreate /> },
              { path: "transferts", element: <Transfers /> },
              { path: "livraisons", element: <Deliveries /> },
              { path: "receptions", element: <Receptions /> },
              { path: "inventaire", element: <Inventory /> },
            ],
          },
          {
            path: "reports",
            element: <Reports />,
            children: [
              { index: true, element: <Navigate to="sales" replace /> },
              { path: "sales", element: <ReportsSalesTable /> },
              { path: "approvisionnement", element: <ReportsSupplyTable /> },
            ],
          },
          { path: "sales", element: <Sales /> },
          { path: "notifications", element: <Notifications /> },
          { path: "messages", element: <Messages /> },
          { path: "profile", element: <Profile /> },
          { path: "settings", element: <Settings /> },
          { path: "help", element: <Help /> },
          { path: "logout", element: <Logout /> },
        ],
      },
    ],
  },
];

const routes = createBrowserRouter([
  ...publicRoutes,
  ...protectedRoutes,
]);

export default routes;
