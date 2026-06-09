import { Badge, Card, CardBody, CardHeader, Progress, Table } from 'reactstrap';

const STATUS_COLORS = {
  normal: 'success',
  warning: 'warning',
  critical: 'danger',
  offline: 'secondary',
};

export default function StationOverview({ stations }) {
  return (
    <Card className="shadow">
      <CardHeader className="border-0">
        <h3 className="mb-0">Station Overview</h3>
      </CardHeader>
      <CardBody className="p-0">
        <Table className="align-items-center table-flush" responsive>
          <thead className="thead-light">
            <tr>
              <th scope="col">Station</th>
              <th scope="col">Status</th>
              <th scope="col">Pressure</th>
              <th scope="col">Flow</th>
              <th scope="col">Sensors</th>
            </tr>
          </thead>
          <tbody>
            {stations.map((station) => {
              const onlinePercent = station.sensorsTotal
                ? Math.round((station.sensorsOnline / station.sensorsTotal) * 100)
                : 0;
              return (
                <tr key={station.id}>
                  <th scope="row">
                    <div className="font-weight-bold">{station.name}</div>
                    <span className="text-muted text-sm">{station.region}</span>
                  </th>
                  <td>
                    <Badge color={STATUS_COLORS[station.status] || 'secondary'}>{station.status}</Badge>
                  </td>
                  <td>{station.pressure === null ? '-' : `${Number(station.pressure).toFixed(1)} bar`}</td>
                  <td>{station.flow === null ? '-' : `${Math.round(Number(station.flow)).toLocaleString()} m3/h`}</td>
                  <td>
                    <div className="d-flex align-items-center">
                      <span className="mr-2 text-sm">{station.sensorsOnline}/{station.sensorsTotal}</span>
                      <div className="flex-fill">
                        <Progress max="100" value={onlinePercent} color={onlinePercent > 90 ? 'success' : 'warning'} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {stations.length === 0 && (
              <tr>
                <td colSpan="5" className="text-center text-muted py-4">
                  No station data available.
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </CardBody>
    </Card>
  );
}
