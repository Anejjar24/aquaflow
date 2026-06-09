import { StationsService } from '../../stations/stations.service';
import { StationStatus } from '../../database/entities/Station.entity';
import { WorkflowNode } from '../../common/types/workflow.types';

export class StationControlHandler {
  constructor(private readonly stationsService: StationsService) {}

  async execute(node: WorkflowNode, input: unknown) {
    const stationId = String(node.data?.stationId || '').trim();
    const rawStatus = String(node.data?.status || 'normal');

    if (!stationId) {
      return { error: 'stationId not configured', updated: false };
    }

    const status = Object.values(StationStatus).includes(rawStatus as StationStatus)
      ? (rawStatus as StationStatus)
      : StationStatus.NORMAL;

    const station = await this.stationsService.update(stationId, { status });

    return {
      updated: true,
      stationId: station.id,
      name: station.name,
      status: station.status,
    };
  }
}
