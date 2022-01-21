import * as cdk from '@aws-cdk/core'
import * as lambda from '@aws-cdk/aws-lambda'
import * as apigw from '@aws-cdk/aws-apigateway'
import * as dynamodb from '@aws-cdk/aws-dynamodb'
import * as kinesis from '@aws-cdk/aws-kinesis'
import { Duration } from '@aws-cdk/core'
import * as lambdaEventSources from '@aws-cdk/aws-lambda-event-sources'
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CloudGsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // The code that defines your stack goes here

    // example resource
    // const queue = new sqs.Queue(this, 'CloudGsQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });

    // create api gateway

    const subscriptionApiGateway = new apigw.RestApi(this, 'api-gw', {
      description: 'example api gateway',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        allowCredentials: false,
        allowOrigins: ['*'],
      },
    })

    // defined an AWS lambda get subscription resource

    const getSubscriptionsLambda = new lambda.Function(
      this,
      'GetSubscriptions',
      {
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset('lambda'),
        handler: 'hello.getAllSubscriptions',
      }
    )

    const postSubscriptionsLambda = new lambda.Function(
      this,
      'PostSubscriptions',
      {
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset('lambda'),
        handler: 'hello.postSubscription',
      }
    )

    // define resources/api routes and attach with lambda fn
    const subscriptionsRoutes =
      subscriptionApiGateway.root.addResource('subscriptions')
    subscriptionsRoutes.addMethod(
      'GET',
      new apigw.LambdaIntegration(getSubscriptionsLambda, { proxy: true })
    )
    subscriptionsRoutes.addMethod(
      'POST',
      new apigw.LambdaIntegration(postSubscriptionsLambda, { proxy: true })
    )

    // create dynamodb table to store data

    const subscriptionsTable = new dynamodb.Table(this, 'subscriptions', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      tableName: 'subscriptions',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    subscriptionsTable.grantReadWriteData(getSubscriptionsLambda)
    subscriptionsTable.grantReadWriteData(postSubscriptionsLambda)

    // define kinesis stream
    const stream = new kinesis.Stream(this, 'events', {
      streamName: 'events',
      shardCount: 3,
      retentionPeriod: Duration.hours(48),
    })

    const eventProcessorLambda = new lambda.Function(this, 'eventProcessor', {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'hello.eventProcessor',
    })

    const eventSource = new lambdaEventSources.KinesisEventSource(stream, {
      startingPosition: lambda.StartingPosition.TRIM_HORIZON,
    })

    eventProcessorLambda.addEventSource(eventSource)
  }
}
