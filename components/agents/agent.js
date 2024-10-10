const AWS = require("aws-sdk");
const dynamodb = new AWS.DynamoDB();
const lambda = new AWS.Lambda();
const bedrock = new AWS.Bedrock();

exports.handler = async (event) => {
  try {
    let stateInput = event.stateInput;
    let response;

    // Step: Is New Request?
    if (stateInput.ResumeWorkflow === "No") {
      // Step: Retrieve Previous State
      response = await dynamodb
        .getItem({
          TableName: "MyDynamoDBTable",
          Key: {
            Column: { S: "MyEntry" },
          },
        })
        .promise();
      // Proceed to Execute Tools
      return await executeTools(stateInput);
    } else {
      // Step: Retrieve available Tools
      response = await dynamodb
        .query({
          TableName: "MyData",
        })
        .promise();
      stateInput.AvailableTools = response.Items;

      // Step: Understand Context & Tool Selection
      response = await bedrock
        .invokeModel({
          ModelId:
            "arn:aws:bedrock:ap-south-1::foundation-model/mistral.mixtral-8x7b-instruct-v0:1",
          Body: {
            prompt: "string",
            max_tokens: 4096,
            stop: [],
            temperature: 0,
            top_p: 1,
            top_k: 1,
          },
        })
        .promise();

      // Proceed to Execute Tools
      return await executeTools(stateInput);
    }
  } catch (error) {
    console.error("Error executing Lambda function", error);
    throw error;
  }
};

async function executeTools(stateInput) {
  try {
    // Step: Evaluate available information
    let response = await bedrock
      .invokeModel({
        ModelId:
          "arn:aws:bedrock:ap-south-1::foundation-model/mistral.mixtral-8x7b-instruct-v0:1",
        Body: {
          prompt: "string",
          max_tokens: 4096,
          stop: [],
          temperature: 0,
          top_p: 1,
          top_k: 1,
        },
      })
      .promise();

    // Step: Complete Info?
    if (stateInput.Response === "Yes") {
      // Step: Execute Tool
      response = await lambda
        .invoke({
          FunctionName: stateInput.LambdaFn,
          Payload: JSON.stringify(stateInput),
        })
        .promise();
      return response.Payload;
    } else {
      // Step: Ask for User Input
      response = await lambda
        .invoke({
          FunctionName: stateInput.LambdaFn,
          Payload: JSON.stringify(stateInput),
        })
        .promise();

      // Step: Persist Current State
      await dynamodb
        .putItem({
          TableName: "MyDynamoDBTable",
          Item: {
            Column: { S: "MyEntry" },
          },
        })
        .promise();
    }

    // Step: Is Response Complete?
    if (stateInput.Response === "Complete") {
      // Step: Prepare Response
      response = await bedrock
        .invokeModel({
          ModelId:
            "arn:aws:bedrock:ap-south-1::foundation-model/mistral.mixtral-8x7b-instruct-v0:1",
          Body: {
            prompt: "string",
            max_tokens: 4096,
            stop: [],
            temperature: 0,
            top_p: 1,
            top_k: 1,
          },
        })
        .promise();
      return response;
    } else {
      // Step: Pass
      return "Pass";
    }
  } catch (error) {
    console.error("Error executing tools", error);
    throw error;
  }
}
