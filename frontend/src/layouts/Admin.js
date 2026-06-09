import React from "react";
import { useLocation, Route, Routes, Navigate } from "react-router-dom";
import { Container } from "reactstrap";
import AdminNavbar from "components/Navbars/AdminNavbar.js";
import AdminFooter from "components/Footers/AdminFooter.js";
import Sidebar from "components/Sidebar/Sidebar.js";
import routes from "routes.js";
import SensorDetailsPage from "modules/monitoring/pages/SensorDetailsPage";
import StationDetailsPage from "modules/stations/pages/StationDetailsPage";
import NotificationDetailsPage from "modules/notifications/pages/NotificationDetailsPage";
import SensorLabPage from "simulator/pages/SensorLabPage";

const Admin = (props) => {
  const mainContent = React.useRef(null);
  const location    = useLocation();

  React.useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
    mainContent.current.scrollTop = 0;
  }, [location]);

  const getRoutes = (routes) =>
    routes.map((prop, key) =>
      prop.layout === "/admin" ? (
        <Route path={prop.path} element={prop.component} key={key} exact />
      ) : null
    );

  const getBrandText = (path) => {
    for (let i = 0; i < routes.length; i++) {
      if (
        props?.location?.pathname.indexOf(
          routes[i].layout + routes[i].path
        ) !== -1
      )
        return routes[i].name;
    }
    return "Brand";
  };

  // The Sensor Lab is a full-screen isolated page — skip the Argon wrapper.
  const isSimLab = location.pathname.startsWith("/admin/sensor-lab");

  if (isSimLab) {
    return (
      <>
        <Sidebar
          {...props}
          routes={routes}
          logo={{
            innerLink: "/admin/dashboard",
            imgSrc:    require("../assets/img/brand/logo.png"),
            imgAlt:    "...",
          }}
        />
        <div className="main-content" ref={mainContent}>
          <SensorLabPage />
        </div>
      </>
    );
  }

  return (
    <>
      <Sidebar
        {...props}
        routes={routes}
        logo={{
          innerLink: "/admin/dashboard",
          imgSrc:    require("../assets/img/brand/logo.png"),
          imgAlt:    "...",
        }}
      />

      <div className="main-content" ref={mainContent}>
        <AdminNavbar
          {...props}
          brandText={getBrandText(location.pathname)}
        />
        <Routes>
          {getRoutes(routes)}
          <Route path="/monitoring/:sensorId" element={<SensorDetailsPage />} />
          <Route path="/stations/:stationId" element={<StationDetailsPage />} />
          <Route path="/notifications/:notificationId" element={<NotificationDetailsPage />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
        <Container fluid>
          <AdminFooter />
        </Container>
      </div>
    </>
  );
};

export default Admin;
