import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as rds from 'aws-cdk-lib/aws-rds'
import { Construct } from 'constructs'
import { deployEnv } from '../utilities/config'

export function createDatabase (scope: Construct, config: any): rds.IDatabaseInstance {
  // will refer to already created DB instance instead of creating new one.
  const database = rds.DatabaseInstance.fromDatabaseInstanceAttributes(
    scope,
    `wisaw-${deployEnv()}`,
    {
      instanceIdentifier: `wisaw-${deployEnv()}`,
      instanceResourceId: config.DB_RESOURCE_ID,
      instanceEndpointAddress: `wisaw-${deployEnv()}.cbaw0b5dcxjh.us-east-1.rds.amazonaws.com`,
      port: 5432,
      securityGroups: []
    }
  )

  database.connections.allowFromAnyIpv4(ec2.Port.tcp(parseInt(config.port)))
  database.connections.allowDefaultPortInternally()

  return database
}
