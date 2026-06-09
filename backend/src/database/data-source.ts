import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Alert } from './entities/Alert.entity';
import { Maintenance } from './entities/Maintenance.entity';
import { Notification } from './entities/Notification.entity';
import { Sensor } from './entities/Sensor.entity';
import { SensorData } from './entities/SensorData.entity';
import { Station } from './entities/Station.entity';
import { User } from './entities/User.entity';
import { Workflow } from './entities/Workflow.entity';
import { WorkflowExecution } from './entities/WorkflowExecution.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: Number(process.env.DATABASE_PORT) || 5432,
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'aquaflow',
  entities: [
    User,
    Station,
    Sensor,
    SensorData,
    Alert,
    Maintenance,
    Workflow,
    WorkflowExecution,
    Notification,
  ],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: false,
  logging: false,
});

export default AppDataSource;
