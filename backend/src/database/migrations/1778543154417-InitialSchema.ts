import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1778543154417 implements MigrationInterface {
    name = 'InitialSchema1778543154417'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'operator', 'technician', 'analyst')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password" character varying(255) NOT NULL, "firstname" character varying(100) NOT NULL, "lastname" character varying(100) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'operator', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."maintenances_type_enum" AS ENUM('preventive', 'corrective', 'inspection', 'repair', 'replacement', 'calibration')`);
        await queryRunner.query(`CREATE TYPE "public"."maintenances_status_enum" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled', 'on_hold')`);
        await queryRunner.query(`CREATE TYPE "public"."maintenances_priority_enum" AS ENUM('low', 'medium', 'high', 'critical')`);
        await queryRunner.query(`CREATE TABLE "maintenances" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "type" "public"."maintenances_type_enum" NOT NULL, "status" "public"."maintenances_status_enum" NOT NULL DEFAULT 'scheduled', "priority" "public"."maintenances_priority_enum" NOT NULL DEFAULT 'medium', "description" text NOT NULL, "workDone" text, "notes" text, "equipment" character varying(255), "partNumber" character varying(255), "estimatedCost" numeric(10,2), "actualCost" numeric(10,2), "estimatedDuration" numeric(5,2), "actualDuration" numeric(5,2), "scheduledDate" TIMESTAMP, "startedAt" TIMESTAMP, "completedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "attachmentUrls" text, "metadata" jsonb, "station_id" uuid, "created_by" uuid, "assigned_to" uuid, CONSTRAINT "PK_62403473bd524a42d58589aa78b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "sensor_data" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "value" numeric(15,4) NOT NULL, "timestamp" TIMESTAMP NOT NULL, "qualityFlags" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "source" character varying(50), "accuracy" numeric(5,2), "sensor_id" uuid, CONSTRAINT "PK_1c0b5610a1a0f690d40239d408d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_018210ef9aa16c3b3bb5409fcd" ON "sensor_data" ("sensor_id", "timestamp") `);
        await queryRunner.query(`CREATE TYPE "public"."sensors_type_enum" AS ENUM('pressure', 'flow', 'temperature', 'quality', 'level', 'ph', 'turbidity', 'chlorine')`);
        await queryRunner.query(`CREATE TYPE "public"."sensors_status_enum" AS ENUM('active', 'inactive', 'faulty', 'offline')`);
        await queryRunner.query(`CREATE TABLE "sensors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "type" "public"."sensors_type_enum" NOT NULL, "unit" character varying(50) NOT NULL, "location" character varying(255), "minThreshold" numeric(10,2), "maxThreshold" numeric(10,2), "lastReading" numeric(10,2), "lastReadingAt" TIMESTAMP, "status" "public"."sensors_status_enum" NOT NULL DEFAULT 'inactive', "alertEnabled" boolean NOT NULL DEFAULT false, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deviceId" character varying(100), "serialNumber" character varying(100), "station_id" uuid, CONSTRAINT "PK_b8bd5fcfd700e39e96bcd9ba6b7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."stations_type_enum" AS ENUM('treatment', 'distribution', 'storage', 'monitoring')`);
        await queryRunner.query(`CREATE TYPE "public"."stations_status_enum" AS ENUM('normal', 'warning', 'critical', 'offline')`);
        await queryRunner.query(`CREATE TABLE "stations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "location" character varying(255) NOT NULL, "latitude" numeric(10,6) NOT NULL, "longitude" numeric(10,6) NOT NULL, "capacity" numeric(10,2) NOT NULL, "capacityUnit" character varying(50) NOT NULL DEFAULT 'liters', "type" "public"."stations_type_enum" NOT NULL DEFAULT 'treatment', "status" "public"."stations_status_enum" NOT NULL DEFAULT 'offline', "description" text, "equipments" text, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lastStatusChange" TIMESTAMP, "created_by" uuid, CONSTRAINT "PK_f047974bd453c85b08bab349367" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_type_enum" AS ENUM('alert', 'maintenance', 'system', 'info')`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_channel_enum" AS ENUM('email', 'sms', 'push', 'in_app')`);
        await queryRunner.query(`CREATE TYPE "public"."notifications_status_enum" AS ENUM('pending', 'sent', 'delivered', 'failed', 'read')`);
        await queryRunner.query(`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."notifications_type_enum" NOT NULL, "channel" "public"."notifications_channel_enum" NOT NULL, "status" "public"."notifications_status_enum" NOT NULL DEFAULT 'pending', "subject" character varying(255) NOT NULL, "content" text NOT NULL, "recipient" character varying(255) NOT NULL, "sentAt" TIMESTAMP, "deliveredAt" TIMESTAMP, "readAt" TIMESTAMP, "failureReason" text, "metadata" jsonb, "retryCount" integer NOT NULL DEFAULT '0', "nextRetryAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "user_id" uuid, "alert_id" uuid, CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."alerts_type_enum" AS ENUM('threshold_violation', 'sensor_offline', 'maintenance_due', 'system_error', 'anomaly', 'critical_event')`);
        await queryRunner.query(`CREATE TYPE "public"."alerts_severity_enum" AS ENUM('info', 'warning', 'error', 'critical')`);
        await queryRunner.query(`CREATE TYPE "public"."alerts_status_enum" AS ENUM('active', 'acknowledged', 'resolved', 'suppressed')`);
        await queryRunner.query(`CREATE TABLE "alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."alerts_type_enum" NOT NULL, "severity" "public"."alerts_severity_enum" NOT NULL, "status" "public"."alerts_status_enum" NOT NULL DEFAULT 'active', "message" text NOT NULL, "description" text, "data" jsonb, "acknowledgedAt" TIMESTAMP, "resolvedAt" TIMESTAMP, "sourceSystem" character varying(100), "isNotified" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "station_id" uuid, "sensor_id" uuid, "acknowledged_by" uuid, "resolved_by" uuid, CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."workflow_executions_status_enum" AS ENUM('running', 'completed', 'failed', 'cancelled', 'paused')`);
        await queryRunner.query(`CREATE TABLE "workflow_executions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."workflow_executions_status_enum" NOT NULL DEFAULT 'running', "input" jsonb, "output" jsonb, "executionLog" jsonb, "triggerSource" character varying(100), "errorMessage" text, "duration" integer NOT NULL DEFAULT '0', "startedAt" TIMESTAMP NOT NULL DEFAULT now(), "completedAt" TIMESTAMP NOT NULL DEFAULT now(), "nodeStates" jsonb, "nodeExecutionCount" integer NOT NULL DEFAULT '0', "successCount" integer NOT NULL DEFAULT '0', "failureCount" integer NOT NULL DEFAULT '0', "currentNode" character varying(100), "stackTrace" text, "metadata" jsonb, "workflow_id" uuid, "triggered_by" uuid, CONSTRAINT "PK_9d49b5c86c267d902145ed42c9d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."workflows_status_enum" AS ENUM('draft', 'active', 'inactive', 'archived')`);
        await queryRunner.query(`CREATE TYPE "public"."workflows_triggertype_enum" AS ENUM('manual', 'scheduled', 'sensor_threshold', 'alert', 'time_based', 'external')`);
        await queryRunner.query(`CREATE TABLE "workflows" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(255) NOT NULL, "description" text, "status" "public"."workflows_status_enum" NOT NULL DEFAULT 'draft', "triggerType" "public"."workflows_triggertype_enum" NOT NULL DEFAULT 'manual', "graph" jsonb NOT NULL, "triggerConfig" jsonb, "tags" character varying(100), "isActive" boolean NOT NULL DEFAULT false, "isPublished" boolean NOT NULL DEFAULT false, "executionCount" integer NOT NULL DEFAULT '0', "lastExecutedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "errorLog" text, "metadata" jsonb, "created_by" uuid, "updated_by" uuid, CONSTRAINT "PK_5b5757cc1cd86268019fef52e0c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "maintenances" ADD CONSTRAINT "FK_a7476417ca59c31f6ffc31e1643" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "maintenances" ADD CONSTRAINT "FK_eb9c1c92e1bce5956c8f07407ea" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "maintenances" ADD CONSTRAINT "FK_654ff5df8693aacbc378c3975bb" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sensor_data" ADD CONSTRAINT "FK_15a4d671e22dc444e5ef7933975" FOREIGN KEY ("sensor_id") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "sensors" ADD CONSTRAINT "FK_f037cfe5209ec3fd74dd26c5f04" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stations" ADD CONSTRAINT "FK_5da7bf829e9e344bc664b6a0b60" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9589e72e51c4f089bb9655d3273" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_18d3f17a656917713f338855504" FOREIGN KEY ("station_id") REFERENCES "stations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_58ea4e249ea6bab25fd9b416629" FOREIGN KEY ("sensor_id") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_70e5404e97a308f93a591991dbd" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_41046b61b52edd41a1ba24079e4" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflow_executions" ADD CONSTRAINT "FK_6347f114eeaac28722f959f6e3f" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflow_executions" ADD CONSTRAINT "FK_40be3ecd1434057cbe3605fe9b9" FOREIGN KEY ("triggered_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflows" ADD CONSTRAINT "FK_5d7e754199da9d7bf87f810ff17" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workflows" ADD CONSTRAINT "FK_733e74f52a379592f051f994c76" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "workflows" DROP CONSTRAINT "FK_733e74f52a379592f051f994c76"`);
        await queryRunner.query(`ALTER TABLE "workflows" DROP CONSTRAINT "FK_5d7e754199da9d7bf87f810ff17"`);
        await queryRunner.query(`ALTER TABLE "workflow_executions" DROP CONSTRAINT "FK_40be3ecd1434057cbe3605fe9b9"`);
        await queryRunner.query(`ALTER TABLE "workflow_executions" DROP CONSTRAINT "FK_6347f114eeaac28722f959f6e3f"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_41046b61b52edd41a1ba24079e4"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_70e5404e97a308f93a591991dbd"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_58ea4e249ea6bab25fd9b416629"`);
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_18d3f17a656917713f338855504"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9589e72e51c4f089bb9655d3273"`);
        await queryRunner.query(`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`);
        await queryRunner.query(`ALTER TABLE "stations" DROP CONSTRAINT "FK_5da7bf829e9e344bc664b6a0b60"`);
        await queryRunner.query(`ALTER TABLE "sensors" DROP CONSTRAINT "FK_f037cfe5209ec3fd74dd26c5f04"`);
        await queryRunner.query(`ALTER TABLE "sensor_data" DROP CONSTRAINT "FK_15a4d671e22dc444e5ef7933975"`);
        await queryRunner.query(`ALTER TABLE "maintenances" DROP CONSTRAINT "FK_654ff5df8693aacbc378c3975bb"`);
        await queryRunner.query(`ALTER TABLE "maintenances" DROP CONSTRAINT "FK_eb9c1c92e1bce5956c8f07407ea"`);
        await queryRunner.query(`ALTER TABLE "maintenances" DROP CONSTRAINT "FK_a7476417ca59c31f6ffc31e1643"`);
        await queryRunner.query(`DROP TABLE "workflows"`);
        await queryRunner.query(`DROP TYPE "public"."workflows_triggertype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."workflows_status_enum"`);
        await queryRunner.query(`DROP TABLE "workflow_executions"`);
        await queryRunner.query(`DROP TYPE "public"."workflow_executions_status_enum"`);
        await queryRunner.query(`DROP TABLE "alerts"`);
        await queryRunner.query(`DROP TYPE "public"."alerts_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."alerts_severity_enum"`);
        await queryRunner.query(`DROP TYPE "public"."alerts_type_enum"`);
        await queryRunner.query(`DROP TABLE "notifications"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_channel_enum"`);
        await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
        await queryRunner.query(`DROP TABLE "stations"`);
        await queryRunner.query(`DROP TYPE "public"."stations_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."stations_type_enum"`);
        await queryRunner.query(`DROP TABLE "sensors"`);
        await queryRunner.query(`DROP TYPE "public"."sensors_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."sensors_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_018210ef9aa16c3b3bb5409fcd"`);
        await queryRunner.query(`DROP TABLE "sensor_data"`);
        await queryRunner.query(`DROP TABLE "maintenances"`);
        await queryRunner.query(`DROP TYPE "public"."maintenances_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."maintenances_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."maintenances_type_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
    }

}
