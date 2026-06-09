import { useSelector } from "react-redux";
import { selectUser } from "store/slices/authSlice";

// reactstrap components
import { Container, Row, Col } from "reactstrap";

const UserHeader = () => {
  const user = useSelector(selectUser);

  const firstName = user?.firstname || "there";

  return (
    <>
      <div
        className="header pb-6 pt-5 pt-lg-6 d-flex align-items-center"
        style={{
          minHeight: "400px",
          backgroundSize: "cover",
          backgroundPosition: "center top",
        }}
      >
        {/* Mask */}
        <span className="mask bg-gradient-default opacity-8" />
        {/* Header container */}
        <Container className="d-flex align-items-center" fluid>
          <Row>
            <Col lg="7" md="10">
              <h1 className="display-2 text-white">Hello {firstName}</h1>
              <p className="text-white mt-0 mb-5">
                This is your profile page. You can see the progress you've made
                with your work and manage your projects or assigned tasks
              </p>
            </Col>
          </Row>
        </Container>
      </div>
    </>
  );
};

export default UserHeader;