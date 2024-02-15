import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";


const cluster = new aws.ecs.Cluster("cluster", {});
const loadbalancer = new awsx.lb.ApplicationLoadBalancer("loadbalancer", {});

// Create the ECR repository to store our container image
const repo = new awsx.ecr.Repository("repo", {
    name: "pulumi-service-catalog",
    forceDelete: true,
});

// const siteImage = new awsx.ecr.Image("pulumi-service-catalog-image", {
//     repositoryUrl: repo.url,
//     platform: "linux/amd64",
//     dockerfile: "./site/Dockerfile",
// });

const config = new pulumi.Config();

const deploymentRepo = new awsx.ecr.Repository("deploymentRepo", {
    name: "pulumi-service-catalog-deployment",
    forceDelete: true,
});

// // Build and publish our application's container image from ./app to the ECR repository.
// const deploytmentImage = new awsx.ecr.Image("pulumi-service-catalog-image", {
//     repositoryUrl: deploymentRepo.url,
//     platform: "linux/amd64",
//     dockerfile: "./deployment-lambda/Dockerfile",
//     args: {
//         "SERVICE_USER": config.get("SERVICE_USER") ?? "",
//         "SERVICE_PASS": config.getSecret("SERVICE_PASS") ?? "",
//     }
// });

// Define the service and configure it to use our image and load balancer.
const service = new awsx.ecs.FargateService("pulumi-service-catalog-svc", {
    cluster: cluster.arn,
    assignPublicIp: true,
    taskDefinitionArgs: {
        container: {
            name: "sveltekit",
            image: '052848974346.dkr.ecr.us-west-2.amazonaws.com/pulumi-service-catalog:latest',
            cpu: 256,
            memory: 512,
            essential: true,
            portMappings: [{
                containerPort: 80,
                targetGroup: loadbalancer.defaultTargetGroup,
            }],
        },
    },
});

// Export the URL so we can easily access it.
export const frontendURL = pulumi.interpolate `http://${loadbalancer.loadBalancer.dnsName}`;

// Create an S3 bucket to host the static files for the single-page application
const siteBucket = new aws.s3.Bucket("siteBucket", {
    website: {
        indexDocument: "index.html",
    },
});

const deploymentLambda = new aws.lambda.Function("deployment-lambda", {
    packageType: "Image",
    imageUri: '052848974346.dkr.ecr.us-west-2.amazonaws.com/pulumi-service-catalog-deployment:latest',
    role: new aws.iam.Role("lambdaRole", {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
            Service: "lambda.amazonaws.com",
        }),
        inlinePolicies: [{
            name: "sfn-policy",
            policy: 
pulumi.interpolate`{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "states:SendTask*"
            ],
            "Resource": [
                "arn:aws:states:us-west-2:052848974346:stateMachine:*"
            ]
        }
    ]
}`
        }],
        managedPolicyArns: ["arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"]
    }).arn,
    timeout: 900,
    environment: {
        variables: {
            "PULUMI_ACCESS_TOKEN": process.env.PULUMI_ACCESS_TOKEN ?? "",
            "PULUMI_HOME": "/tmp",
            "ORGANIZATION": "initech"
        }
    },
});

const sfnRole = new aws.iam.Role("sfnRole", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: `states.${process.env.AWS_REGION}.amazonaws.com` }),
    inlinePolicies: [{
        name: "sfn-policy",
        policy: 
pulumi.interpolate`{
"Version": "2012-10-17",
"Statement": [
    {
        "Effect": "Allow",
        "Action": [
            "lambda:InvokeFunction"
        ],
        "Resource": [
            "${deploymentLambda.arn}:$LATEST"
        ]
    }
]
}`
    }],
});
  

const sfn = new aws.sfn.StateMachine('deployment-state-machine', {
    name: 'sc-deployment-state-machine',
    definition: 
pulumi.interpolate`{
    "Comment": "Maintain the execution state of the service catalog deployment lambda",
    "StartAt": "Lambda Invoke",
    "States": {
        "Lambda Invoke": {
        "Type": "Task",
        "Resource": "arn:aws:states:::lambda:invoke.waitForTaskToken",
        "Parameters": {
            "Payload": {
            "input.$": "$",
            "taskToken.$": "$$.Task.Token"
            },
            "FunctionName": "${deploymentLambda.arn}:$LATEST"
        },
        "Retry": [
            {
            "ErrorEquals": [
                "Lambda.ServiceException",
                "Lambda.AWSLambdaException",
                "Lambda.SdkClientException",
                "Lambda.TooManyRequestsException"
            ],
            "IntervalSeconds": 1,
            "MaxAttempts": 3,
            "BackoffRate": 2
            }
        ],
        "End": true
        }
    },
    "TimeoutSeconds": 900
}`,
    roleArn: sfnRole.arn
})


// Upload the static files to the S3 bucket
// const indexFile = new aws.s3.BucketObject("indexFile", {
//     bucket: siteBucket,
//     key: "index.html",
//     source: new pulumi.asset.FileAsset("path/to/index.html"), // replace with the path to your index.html file
//     contentType: "text/html",
// });


// Create an AWS Lambda function for the backend for frontend
// const bffLambda = new aws.lambda.Function("bffLambda", {
//     code: new pulumi.asset.AssetArchive({
//         ".": new pulumi.asset.FileArchive("./site/site.zip"), // replace with the path to your lambda directory
//     }),
//     handler: "lambda-handler.handler", // replace with the name of the handler file and export
//     role: new aws.iam.Role("lambdaRole", {
//         assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
//             Service: "lambda.amazonaws.com",
//         }),
//     }).arn,
//     runtime: aws.lambda.Runtime.NodeJS18dX, // replace with the desired runtime if different
// });


// Create the API Gateway for the BFF
// const apiGateway = new aws.apigatewayv2.Api("apiGateway", {
//     protocolType: "HTTP",
//     routeSelectionExpression: "${request.method} ${request.path}",
// });

// Create a route for the API Gateway that connects to the Lambda function
// const lambdaIntegration = new aws.apigatewayv2.Integration("lambdaIntegration", {
//     apiId: apiGateway.id,
//     integrationType: "AWS_PROXY",
//     integrationUri: bffLambda.invokeArn,
//     payloadFormatVersion: "2.0",
// });

// const apiGatewayRoute = new aws.apigatewayv2.Route("apiGatewayRoute", {
//     apiId: apiGateway.id,
//     routeKey: "ANY /{proxy+}", // This route key directs all traffic to the Lambda
//     target: pulumi.interpolate`integrations/${lambdaIntegration.id}`,
// });

// Create a CloudFront distribution for the site
// const siteDistribution = new aws.cloudfront.Distribution("siteDistribution", {
//     enabled: true,
//     origins: [{
//         domainName: siteBucket.bucketRegionalDomainName,
//         originId: siteBucket.arn,
//         s3OriginConfig: {
//             originAccessIdentity: "origin-access-identity/cloudfront/EXAMPLE", // replace with your Origin Access Identity
//         },
//     }],
//     defaultRootObject: "index.html",
//     defaultCacheBehavior: {
//         allowedMethods: [
//             "GET",
//             "HEAD",
//             "OPTIONS",
//         ],
//         cachedMethods: ["GET", "HEAD"],
//         targetOriginId: siteBucket.arn,
//         forwardedValues: {
//             queryString: false,
//             cookies: { forward: "none" },
//         },
//         viewerProtocolPolicy: "redirect-to-https",
//         minTtl: 0,
//         defaultTtl: 3600,
//         maxTtl: 86400,
//     },
//     priceClass: "PriceClass_All",
//     customErrorResponses: [{
//         errorCode: 404,
//         responseCode: 404,
//         responsePagePath: "/index.html",
//     }],
//     restrictions: {
//         geoRestriction: {
//             restrictionType: "none",
//         },
//     },
//     viewerCertificate: {
//         cloudfrontDefaultCertificate: true,
//     },
// });

// Output the URLs of the S3 Bucket and CloudFront distribution
export const bucketUrl = siteBucket.websiteEndpoint;
//export const distributionUrl = siteDistribution.domainName;