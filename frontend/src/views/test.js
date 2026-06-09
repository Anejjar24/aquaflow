// reactstrap components
import { Card, Container, Row } from "reactstrap";

// core components
import Header from "components/Headers/Header.js";


// src/App.jsx
import BuilderPage from "./builder/BuilderPage.jsx";


const Test = () => {
  return (
    <>
      <Header />
      {/* Page content */}
      <Container className="mt--7" fluid>
        <Row>
          <div className="col">
            <Card className="shadow border-0">
              
              

              <BuilderPage />

            </Card>
          </div>
        </Row>
      </Container>
    </>
  );
};

export default Test;
