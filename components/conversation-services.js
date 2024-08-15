const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, DynamoDBDocumentClient, QueryCommand: DDBQueryCommand } = require("@aws-sdk/lib-dynamodb");

async function mutateConversation(conversationId, query, nextQuery, textResponse, decodedToken) {
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    const { v4: uuidv4 } = require('uuid');

    if (conversationId == "") {
        conversationId = uuidv4()
        // Write Conversation details to Summary Table
        const commandNewConv = new PutCommand({
            TableName: process.env.DDBTable_ConversationSummary,
            Item: {
                id: conversationId,
                appId: decodedToken.applicationIdQ,
                conversationDate: new Date().toISOString()
            },
        });
        //test

        const responseNewConv = await docClient.send(commandNewConv);
    }

    const messageId = uuidv4();

    const command = new PutCommand({
        TableName: process.env.conversationDDBTableName,
        Item: {
            conversationId: conversationId,
            messageId: messageId,
            conversationDate: new Date().toISOString(),
            question: query,
            modifiedQuestion: nextQuery,
            response: textResponse
        },
    });

    const response = await docClient.send(command);
    return { conversationId, messageId };

}

async function queryConversastion(conversationId) {
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);

    const command = new DDBQueryCommand({
        TableName: process.env.conversationDDBTableName,
        IndexName: "byConversationId",
        KeyConditionExpression:
            "conversationId = :conversationId",
        ExpressionAttributeValues: {
            ":conversationId": conversationId
        },
        ConsistentRead: false,
    });

    const response = await docClient.send(command);
    return response.Items;

}

module.exports =  {mutateConversation, queryConversastion};