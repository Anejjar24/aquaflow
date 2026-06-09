import { Card, CardBody, Col, Row } from 'reactstrap';

const STATUS_COLORS = {
  normal: 'success',
  warning: 'warning',
  critical: 'danger',
  offline: 'secondary',
};

export default function KPISection({ kpis }) {
  return (
    <Row>
      {kpis.map((kpi) => (
        <Col lg="3" md="6" key={kpi.id}>
          <Card className="card-stats mb-4 mb-xl-0">
            <CardBody>
              <Row>
                <div className="col">
                  <h5 className="card-title text-uppercase text-muted mb-0">{kpi.label}</h5>
                  <span className="h2 font-weight-bold mb-0">
                    {kpi.value}
                    {kpi.unit && <span className="h5 ml-1 text-muted">{kpi.unit}</span>}
                  </span>
                </div>
                <Col className="col-auto">
                  <div className={`icon icon-shape bg-${STATUS_COLORS[kpi.status] || 'info'} text-white rounded-circle shadow`}>
                    <i className={kpi.icon} />
                  </div>
                </Col>
              </Row>
              <p className="mt-3 mb-0 text-muted text-sm">
                <span className={kpi.status === 'normal' ? 'text-success mr-2' : 'text-warning mr-2'}>
                  <i className={kpi.status === 'normal' ? 'fa fa-check' : 'fa fa-exclamation-triangle'} /> {kpi.trend}
                </span>
                <span className="text-nowrap">from live database</span>
              </p>
            </CardBody>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
