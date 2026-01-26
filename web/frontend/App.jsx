import { BrowserRouter, Link, Route } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NavMenu } from "@shopify/app-bridge-react";
import Routes from "./Routes";
import { ToastContainer } from "react-toastify"

import { QueryProvider, PolarisProvider } from "./components";
import CSV from "./pages/CSV";
import Settings from "./pages/Settings.jsx";
import SettingsPage from "./pages/Settings.jsx";

export default function App() {
  // Any .tsx or .jsx files in /pages will become a route
  // See documentation for <Routes /> for more info
  const pages = import.meta.glob("./pages/**/!(*.test.[jt]sx)*.([jt]sx)", {
    eager: true,
  });
  const { t } = useTranslation();

  return (
    <PolarisProvider>
      <BrowserRouter>
        <QueryProvider>
          <NavMenu>
            <Link to="/" rel="home" />
            <Link to="/CSV" element={<CSV />} > ORDER </Link>
            <Link to="/Settings" element={<SettingsPage />} > SETTINGS </Link>
            {/* <Link to="/pagename">{t("NavigationMenu.pageName")}</Link> */}
          </NavMenu>
          <Routes pages={pages} />
          <ToastContainer />
        </QueryProvider>
      </BrowserRouter>
    </PolarisProvider>
  );
} 