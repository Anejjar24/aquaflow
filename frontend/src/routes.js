
import Profile from "views/examples/Profile.js";
import DashboardPage from "modules/dashboard/pages/DashboardPage";
import StationsPage from "modules/stations/pages/StationsPage";
import MonitoringPage from "modules/monitoring/pages/MonitoringPage";
import AlertsPage from "modules/alerts/pages/AlertsPage";
import MaintenancePage from "modules/maintenance/pages/MaintenancePage";
import AnalyticsPage from "modules/analytics/pages/AnalyticsPage";
import NotificationsPage from "modules/notifications/pages/NotificationsPage";
import UsersPage from "modules/users/pages/UsersPage";
import Login from "modules/auth/pages/Login";
import Register from "modules/auth/pages/Register";
import BuilderPage from "views/builder/BuilderPage";
import Test from "views/test.js";
import SensorLabPage from "simulator/pages/SensorLabPage";

var routes = [
  {
    path: "/dashboard",
    name: "Dashboard",
    icon: "ni ni-tv-2 text-primary",
    component: <DashboardPage />,
    layout: "/admin",
  },
  {
    path: "/builder",
    name: "Automation Builder",
    icon: "ni ni-vector text-info",
    component: <BuilderPage />,
    layout: "/admin",
  },
  {
    path: "/stations",
    name: "Stations",
    icon: "ni ni-building text-success",
    component: <StationsPage />,
    layout: "/admin",
  },
  {
    path: "/monitoring",
    name: "Monitoring",
    icon: "ni ni-sound-wave text-info",
    component: <MonitoringPage />,
    layout: "/admin",
  },
  {
    path: "/alerts",
    name: "Alerts",
    icon: "ni ni-bell-55 text-red",
    component: <AlertsPage />,
    layout: "/admin",
  },
  {
    path: "/maintenance",
    name: "Maintenance",
    icon: "ni ni-settings text-warning",
    component: <MaintenancePage />,
    layout: "/admin",
  },
  {
    path: "/analytics",
    name: "Analytics",
    icon: "ni ni-chart-pie-35 text-primary",
    component: <AnalyticsPage />,
    layout: "/admin",
  },
  {
    path: "/test",
    name: "Diagnostics",
    icon: "ni ni-settings text-orange",
    component: <Test />,
    layout: "/admin",
  },
  {
    path: "/sensor-lab",
    name: "Sensor Lab",
    icon: "ni ni-atom text-cyan",
    component: <SensorLabPage />,
    layout: "/admin",
  },
  // {
  //   path: "/icons",
  //   name: "Icons",
  //   icon: "ni ni-planet text-blue",
  //   component: <Icons />,
  //   layout: "/admin",
  // },
  // {
  //   path: "/maps",
  //   name: "Maps",
  //   icon: "ni ni-pin-3 text-orange",
  //   component: <Maps />,
  //   layout: "/admin",
  // },
  {
    path: "/notifications",
    name: "Notifications",
    icon: "ni ni-bell-55 text-info",
    component: <NotificationsPage />,
    layout: "/admin",
  },
  {
    path: "/users",
    name: "User Management",
    icon: "ni ni-single-02 text-dark",
    component: <UsersPage />,
    layout: "/admin",
    adminOnly: true,
  },
  {
    path: "/user-profile",
    name: "User Profile",
    icon: "ni ni-single-02 text-yellow",
    component: <Profile />,
    layout: "/admin",
  },
  // {
  //   path: "/tables",
  //   name: "Tables",
  //   icon: "ni ni-bullet-list-67 text-red",
  //   component: <Tables />,
  //   layout: "/admin",
  // },
  {
    path: "/login",
    name: "Login",
    icon: "ni ni-key-25 text-info",
    component: <Login />,
    layout: "/auth",
  },
  {
    path: "/register",
    name: "Register",
    icon: "ni ni-circle-08 text-pink",
    component: <Register/>,
    layout: "/auth",
  }
  
];
export default routes;
