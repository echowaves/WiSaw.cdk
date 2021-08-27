# WiSaw.cdk
## References
Main walkthrough doc:
https://aws.amazon.com/blogs/mobile/building-real-time-serverless-apis-with-postgres-cdk-typescript-and-aws-appsync/

Build API with GraphQL, Node.js, and Sequelize
https://dev.to/nedsoft/build-api-with-graphql-node-js-and-sequelize-5e8e


GraphQL geo location:
https://hasura.io/blog/graphql-and-geo-location-on-postgres-using-hasura-562e7bd47a2f/
https://medium.com/@tobinc/aws-amplify-graphql-with-geo-point-and-custom-resources-free-elasticsearch-provider-d1742fbc4ceb
https://gerard-sans.medium.com/finding-the-nearest-locations-around-you-using-aws-amplify-part-1-ee4d6a14eec9
https://dev.to/aws-builders/the-guide-to-implement-geo-search-in-your-react-native-app-with-aws-amplify-1m82


Deploy scalable NodeJS application with Postgres database using AWS CDK
https://dev.to/skona27/deploy-scalable-nodejs-application-with-postgres-database-using-aws-cdk-22l4


Deploy aws-cdk app to different environments
https://dev.to/miensol/deploy-aws-cdk-app-to-different-environments-297d



The Power of Serverless GraphQL with AWS AppSync
https://serverless.pub/the-power-of-serverless-graphql-with-appsync/

5 Ways To Bundle a Lambda Function Within an AWS CDK Construct
https://www.sebastianhesse.de/2021/01/16/5-ways-to-bundle-a-lambda-function-within-an-aws-cdk-construct/

FFmpeg/FFprobe Lambda Layer for Amazon Linux 2 AMIs
https://serverlessrepo.aws.amazon.com/applications/us-east-1/145266761615/ffmpeg-lambda-layer
https://github.com/serverlesspub/ffmpeg-aws-lambda-layer
https://bobbyhadz.com/blog/aws-cdk-lambda-layers


## Restore snapshot for tesdt db
DB instance identifier: wisaw-test
Default VPC
subnet group: default
Public access: yes
VPC security group: existing, default
DB instance class: burstable, t3.micro
Availablity and durablity: do not create standby node, us-east-1d
Database Authentication: password

Then right click and modify to change the master password



To see your and others photos visit https://www.wisaw.com
