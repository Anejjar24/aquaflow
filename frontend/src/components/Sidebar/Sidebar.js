/*eslint-disable*/
import { useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { NavLink as NavLinkRRD, Link } from "react-router-dom";
import { PropTypes } from "prop-types";
import useLogout from "hooks/useLogout";
import { selectSidebarMini, toggleSidebarMini } from "store/slices/uiSlice";
import { selectUserRole } from "store/slices/authSlice";
import {
  Collapse,
  DropdownMenu,
  DropdownItem,
  UncontrolledDropdown,
  DropdownToggle,
  Media,
  NavbarBrand,
  Navbar,
  NavItem,
  NavLink,
  Nav,
  Container,
  Row,
  Col,
  Form,
  Input,
  InputGroupAddon,
  InputGroupText,
  InputGroup,
} from "reactstrap";

const SIDEBAR_FULL = 250; // px — expanded
const SIDEBAR_MINI = 68;  // px — icon-only
const MD_BREAKPOINT = 768;

const Sidebar = (props) => {
  const logout = useLogout();
  const dispatch = useDispatch();
  const mini = useSelector(selectSidebarMini);
  const userRole = useSelector(selectUserRole);
  const [collapseOpen, setCollapseOpen] = useState(false);
  const [isDesktop, setIsDesktop]       = useState(
    typeof window !== "undefined" && window.innerWidth >= MD_BREAKPOINT
  );

  // Applique margin-left sur .main-content — desktop uniquement
  const applyMargin = useCallback((isMini) => {
    const el = document.querySelector(".main-content");
    if (!el) return;

    if (window.innerWidth < MD_BREAKPOINT) {
      // Mobile : reset inline — Argon gère le layout
      el.style.marginLeft = "";
      el.style.transition = "";
      return;
    }

    // Desktop : on pilote le margin via JS
    el.style.transition  = "margin-left 0.28s ease";
    el.style.marginLeft  = (isMini ? SIDEBAR_MINI : SIDEBAR_FULL) + "px";
  }, []);

  // Réagir au changement de mini
  useEffect(() => {
    applyMargin(mini);
  }, [mini, applyMargin]);

  // Réagir au resize de la fenêtre
  useEffect(() => {
    const onResize = () => {
      const desktop = window.innerWidth >= MD_BREAKPOINT;
      setIsDesktop(desktop);
      applyMargin(mini);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [mini, applyMargin]);

  const toggleCollapse = () => setCollapseOpen((v) => !v);
  const closeCollapse  = () => setCollapseOpen(false);

  const createLinks = (routes) =>
  routes
    .filter((prop) => prop.layout === "/admin")
    .filter((prop) => !prop.adminOnly || userRole === 'admin')
    .map((prop, key) => (
      <NavItem key={key}>
        <NavLink
          to={prop.layout + prop.path}
          tag={NavLinkRRD}
          onClick={closeCollapse}
          title={isDesktop && mini ? prop.name : undefined}
          style={isDesktop ? linkStyle(mini) : {}}
        >
          <i className={prop.icon} style={isDesktop ? iconStyle(mini) : {}} />
          {(!isDesktop || !mini) && <span>{prop.name}</span>}
        </NavLink>
      </NavItem>
    ));

  const { routes, logo } = props;
  let navbarBrandProps = {};
  if (logo?.innerLink)       navbarBrandProps = { to: logo.innerLink, tag: Link };
  else if (logo?.outterLink) navbarBrandProps = { href: logo.outterLink, target: "_blank" };

  return (
    <Navbar
      className="navbar-vertical fixed-left navbar-light bg-white"
      expand="md"
      id="sidenav-main"
      style={isDesktop ? {
        width:      (mini ? SIDEBAR_MINI : SIDEBAR_FULL) + "px",
        minWidth:   (mini ? SIDEBAR_MINI : SIDEBAR_FULL) + "px",
        maxWidth:   (mini ? SIDEBAR_MINI : SIDEBAR_FULL) + "px",
        transition: "width 0.28s ease, min-width 0.28s ease, max-width 0.28s ease",
        overflow:   "hidden",
      } : {}}
    >
      <Container fluid style={isDesktop ? { padding: 0 } : {}}>

        {/* ── Mobile toggler ─────────────────────────────────── */}
        <button className="navbar-toggler" type="button" onClick={toggleCollapse}>
          <span className="navbar-toggler-icon" />
        </button>

        {/* ── Logo ───────────────────────────────────────────── */}
        {logo && (
          <NavbarBrand
            className="pt-0"
            {...navbarBrandProps}
            style={isDesktop ? {
              display:        "flex",
              justifyContent: mini ? "center" : "flex-start",
              width:          "100%",
              marginRight:    0,
            } : {}}
          >
            <img
              alt={logo.imgAlt}
              className="navbar-brand-img"
              src={
                isDesktop && mini
                  ? require("../../assets/img/brand/box.png")
                  : logo.imgSrc
              }
              style={isDesktop ? {
                maxWidth:   mini ? "36px" : "140px",
                height:     "auto",
                transition: "max-width 0.28s ease",
              } : {}}
            />
          </NavbarBrand>
        )}

        {/* ── Mobile user icons ──────────────────────────────── */}
        <Nav className="align-items-center d-md-none">
          <UncontrolledDropdown nav>
            <DropdownToggle nav className="nav-link-icon">
              <i className="ni ni-bell-55" />
            </DropdownToggle>
            <DropdownMenu
              aria-labelledby="navbar-default_dropdown_1"
              className="dropdown-menu-arrow"
              right
            >
              <DropdownItem>Action</DropdownItem>
              <DropdownItem>Another action</DropdownItem>
              <DropdownItem divider />
              <DropdownItem>Something else here</DropdownItem>
            </DropdownMenu>
          </UncontrolledDropdown>

          <UncontrolledDropdown nav>
            <DropdownToggle nav>
              <Media className="align-items-center">
                <span className="avatar avatar-sm rounded-circle">
                  <img
                    alt="..."
                    src={require("../../assets/img/theme/team-1-800x800.jpg")}
                  />
                </span>
              </Media>
            </DropdownToggle>
            <DropdownMenu className="dropdown-menu-arrow" right>
              <DropdownItem className="noti-title" header tag="div">
                <h6 className="text-overflow m-0">Welcome!</h6>
              </DropdownItem>
              <DropdownItem to="/admin/user-profile" tag={Link}>
                <i className="ni ni-single-02" /><span>My profile</span>
              </DropdownItem>
              <DropdownItem to="/admin/user-profile" tag={Link}>
                <i className="ni ni-settings-gear-65" /><span>Settings</span>
              </DropdownItem>
              <DropdownItem to="/admin/user-profile" tag={Link}>
                <i className="ni ni-calendar-grid-58" /><span>Activity</span>
              </DropdownItem>
              <DropdownItem to="/admin/user-profile" tag={Link}>
                <i className="ni ni-support-16" /><span>Support</span>
              </DropdownItem>
              <DropdownItem divider />
              <DropdownItem
                href="#pablo"
                onClick={(e) => {
                  e.preventDefault();
                  logout();
                }}
              >
                <i className="ni ni-user-run" /><span>Logout</span>
              </DropdownItem>
            </DropdownMenu>
          </UncontrolledDropdown>
        </Nav>

        {/* ── Collapsible nav ────────────────────────────────── */}
        <Collapse navbar isOpen={collapseOpen}>

          {/* Mobile collapse header */}
          <div className="navbar-collapse-header d-md-none">
            <Row>
              {logo && (
                <Col className="collapse-brand" xs="6">
                  {logo.innerLink
                    ? <Link to={logo.innerLink}><img alt={logo.imgAlt} src={logo.imgSrc} /></Link>
                    : <a href={logo.outterLink}><img alt={logo.imgAlt} src={logo.imgSrc} /></a>
                  }
                </Col>
              )}
              <Col className="collapse-close" xs="6">
                <button className="navbar-toggler" type="button" onClick={toggleCollapse}>
                  <span /><span />
                </button>
              </Col>
            </Row>
          </div>

          {/* Mobile search */}
          <Form className="mt-4 mb-3 d-md-none">
            <InputGroup className="input-group-rounded input-group-merge">
              <Input
                aria-label="Search"
                className="form-control-rounded form-control-prepended"
                placeholder="Search"
                type="search"
              />
              <InputGroupAddon addonType="prepend">
                <InputGroupText>
                  <span className="fa fa-search" />
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>
          </Form>

          {/* ── Bouton toggle mini — desktop uniquement ─────── */}
          <Nav navbar className="d-none d-md-block mb-1">
            <NavItem>
              <NavLink
                href="#"
                onClick={(e) => { e.preventDefault(); dispatch(toggleSidebarMini()); }}
                title={mini ? "Expand sidebar" : "Collapse sidebar"}
                style={{ ...linkStyle(mini), cursor: "pointer" }}
              >
                <i
                  className="fa fa-bars"
                  style={{ ...iconStyle(mini), fontSize: "1.15rem" }}
                />
              </NavLink>
            </NavItem>
          </Nav>

          {/* Routes principales */}
          <Nav navbar>{createLinks(routes)}</Nav>

          <hr className="my-3" />

          <Nav navbar className="mb-2">
            <NavItem>
              <NavLink
                href="#pablo"
                onClick={(e) => {
                  e.preventDefault();
                  logout();
                }}
                title={isDesktop && mini ? "Logout" : undefined}
                style={isDesktop ? linkStyle(mini) : {}}
              >
                <i className="ni ni-user-run text-red" style={isDesktop ? iconStyle(mini) : {}} />
                {(!isDesktop || !mini) && <span>Logout</span>}
              </NavLink>
            </NavItem>
          </Nav>

          {/* Heading masqué en mini desktop */}
          {(!isDesktop || !mini) && (
            <h6 className="navbar-heading text-muted">Side Parts</h6>
          )}

          <Nav className="mb-md-3" navbar>
            {[
              { href: "https://", icon: "ni ni-spaceship", label: "part1" },
              { href: "https://", icon: "ni ni-palette",   label: "part2" },
              { href: "https://", icon: "ni ni-ui-04",     label: "part3" },
            ].map((item, key) => (
              <NavItem key={key}>
                <NavLink
                  href={item.href}
                  title={isDesktop && mini ? item.label : undefined}
                  style={isDesktop ? linkStyle(mini) : {}}
                >
                  <i className={item.icon} style={isDesktop ? iconStyle(mini) : {}} />
                  {(!isDesktop || !mini) && item.label}
                </NavLink>
              </NavItem>
            ))}
          </Nav>

        </Collapse>
      </Container>
    </Navbar>
  );
};

// ── Style helpers — utilisés uniquement sur desktop ───────────────────────────

function linkStyle(mini) {
  return {
    display:        "flex",
    alignItems:     "center",
    justifyContent: mini ? "center" : "flex-start",
    padding:        mini ? "0.65rem 0" : "0.65rem 1.5rem",
    whiteSpace:     "nowrap",
    overflow:       "hidden",
    transition:     "padding 0.28s ease",
  };
}

function iconStyle(mini) {
  return {
    fontSize:    "0.9375rem",
    minWidth:    "1.5rem",
    textAlign:   "center",
    marginRight: mini ? "0" : "0.5rem",
    transition:  "margin 0.28s ease",
    flexShrink:  0,
  };
}

// ── Prop types ────────────────────────────────────────────────────────────────

Sidebar.defaultProps = { routes: [{}] };

Sidebar.propTypes = {
  routes: PropTypes.arrayOf(PropTypes.object),
  logo: PropTypes.shape({
    innerLink:  PropTypes.string,
    outterLink: PropTypes.string,
    imgSrc:     PropTypes.string.isRequired,
    imgAlt:     PropTypes.string.isRequired,
  }),
};

export default Sidebar;
