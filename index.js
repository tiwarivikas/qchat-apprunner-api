require('dotenv').config();
const cors = require('cors');
const express = require('express');
const jwt = require('jsonwebtoken');
const { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } = require("@aws-sdk/client-bedrock-runtime"); // ES Modules const
const { KendraClient, QueryCommand, QueryResultType, RetrieveCommand } = require("@aws-sdk/client-kendra"); // ES Modules const
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { PutCommand, DynamoDBDocumentClient, QueryCommand: DDBQueryCommand } = require("@aws-sdk/lib-dynamodb");


const app = express();
const PORT = process.env.PORT || 3000;

// Use the cors middleware
app.use(cors());

// Optionally, configure CORS to allow specific origins
/* app.use(cors({
    origin: 'http://your-allowed-origin.com',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
})); */

// Secret key for JWT verification
const SECRET_KEY = process.env.SECRET_KEY;

var decodedToken;

// Middleware to validate JWT
function authenticateJWT(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];

        if (authHeader) {
            const token = authHeader.split(' ')[1];

            // Decode and validate the JWT token
            decodedToken = jwt.verify(token, SECRET_KEY);

            // Validate expiry
            const expiryTimestamp = decodedToken.exp * 1000;
            if (expiryTimestamp < Date.now()) {
                res.status(403).send('Exception: JWT token has expired. Please contact admin ')
            }
            next();
        } else {
            res.status(401).send('Exception: JWT Token is missing.')// Unauthorized
        }
    } catch (err) {
        console.log(err)
        res.status(403).send('Exception: JWT Token is not valid.');
    }
}

// SSE endpoint
app.get('/stream', authenticateJWT, async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
/*     res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization"); */

    const chatMsg = req.query.chat;
    if (!chatMsg) res.status(401).send('Exception: Chat Param is missing.')

    const response = await chat(chatMsg, decodedToken, res)

    // Clean up when client closes connection
    req.on('close', () => {
        // clearInterval(intervalId);
        res.end();
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

async function chat(userMsg, decodedToken, res) {
    let region;
    let textResponse;
    let attributions = [];
    let outputBR = { response: '', sourceAttributions: [] };
    let qnaHistory = '';
    let nextQuery = '';



    try {
        const msg = JSON.parse(userMsg);
        const query = msg.userMessage;
        conversationId = msg.conversationId;

        if (conversationId) {
            console.log("****** Retrieving Conversation *******")
            const conversationHistory = await queryConversastion(conversationId);
            qnaHistory = conversationHistory?.map((item) => {
                return (
                    `Query: ${item.question} 
Response: ${item.response}`)
            }).join('\n') || '';

        }

        const handleGreetingsPrompt = llmPrompt("FIRST_PROMPT", decodedToken.customer, decodedToken.chatbotName, qnaHistory, query, "", "")

        const respLLM = await executeBedrockAPI(handleGreetingsPrompt)

        const firstLLMResponse = extractFirstJSON(respLLM);

        if (firstLLMResponse?.context == "greeting") {
            textResponse = firstLLMResponse.response
        } else if (firstLLMResponse?.context == "new-query") {
            nextQuery = ""
        } else if (firstLLMResponse?.context == "follow-up") {
            nextQuery = firstLLMResponse.response
        }

        if (firstLLMResponse?.context == "new-query" ||
            firstLLMResponse?.context == "follow-up") {
            //const kendraResponse = await queryKendraFAQs(query)
            const kendraRetrieveResponse = await retrieveKendraSearch(nextQuery ? nextQuery : query, decodedToken.applicationIdQ)

            if (/* !kendraResponse &&  */!kendraRetrieveResponse) {
                var outputResponse = {
                    conversationId: conversationId,
                    failedAttachments: [],
                    sourceAttributions: [],
                    systemMessage: "Sorry, I couldn't find any relevant information.",
                    systemMessageId: '',
                    userMessageId: '',
                };
                return outputResponse;
            }

            const fullPrompt = llmPrompt("SECOND_PROMPT", decodedToken.customer, decodedToken.chatbotName, qnaHistory, query, nextQuery, kendraRetrieveResponse)

            const response = await executeBedrockStreamingAPI(fullPrompt)

            res.write('data: [START]\n\n');

            let tmpResponse = ""
            let blnResponseStarted = false
            let blnResponseFinished = false
            let tmpResponseTextOnly = ""

            for await (const event of response.body) {
                const chunk = event.chunk;
                if (chunk) {
                    const decodedChunk = JSON.parse(new TextDecoder().decode(chunk.bytes));
                    const txtChunk = decodedChunk.outputs[0].text
                    tmpResponse = tmpResponse + txtChunk;
                    if (blnResponseStarted && !blnResponseFinished) {
                        if (tmpResponse.search('",') > 0) {
                            blnResponseFinished = true
                        } else {
                            res.write(`data: ${txtChunk}\n\n`);
                            tmpResponseTextOnly = tmpResponseTextOnly + txtChunk;
                        }
                    } else if (tmpResponse.search('"response": "') > 0 && !blnResponseFinished) {
                        blnResponseStarted = true
                    }
                }
            };

            console.log(tmpResponse)

            const secondLLMResponse = extractFirstJSON(tmpResponse);

            //Now parse the complete JSON.
            outputBR = JSON.parse(tmpResponse)
            textResponse = outputBR.response?.trim();
            attributions = outputBR.sourceAttributions?.
                filter(function (v, i, self) {

                    // It returns the index of the first
                    // instance of each value
                    return i == self.indexOf(v);
                })
            const resultConvMutation = await mutateConversation(conversationId, query, nextQuery || "", textResponse, decodedToken)
            messageId = resultConvMutation.messageId
            conversationId = resultConvMutation.conversationId

            var outputResponse = {
                conversationId: conversationId,
                failedAttachments: [],
                sourceAttributions: attributions,
                systemMessage: textResponse || tmpResponseTextOnly,
                systemMessageId: messageId,
                userMessageId: '',
            };

        } else {
            var outputResponse = {
                conversationId: conversationId,
                failedAttachments: [],
                sourceAttributions: attributions,
                systemMessage: textResponse,
                systemMessageId: messageId,
                userMessageId: '',
            };
            //return outputResponse;
        }

        res.write('data: [COMPLETE]\n\n');
        res.write(`data: ${JSON.stringify(outputResponse)}\n\n`);
        res.write('data: [END]\n\n');
        res.end();

        return;

    } catch (error) {
        console.log(error);
        var outputResponse = {
            conversationId: conversationId,
            failedAttachments: [],
            sourceAttributions: [],
            systemMessage: "Exception: An error has occurred, please try again.",
            systemMessageId: '',
            userMessageId: '',
        };
        res.write('data: [COMPLETE]\n\n');
        res.write(`data: ${JSON.stringify(outputResponse)}\n\n`);
        res.write('data: [END]\n\n');
        res.end();
        return;
        //return "Exception: Assistant is not available. Please try after some time.";
    }
}

async function retrieveKendraSearch(query, dsId) {
    try {
        const client = new KendraClient({ region: "ap-south-1" });
        const inputKendra = {
            AttributeFilter:
            {
                OrAllFilters: [{
                    EqualsTo: {
                        Key: "_data_source_id",
                        Value: { StringValue: `${dsId}` }
                    }
                }]
            },
            IndexId: "2786d8bd-676a-4c34-bda0-a1cea0832c29",
            PageNumber: 1,
            PageSize: 10,
            QueryText: query,
            SpellCorrectionConfiguration: { IncludeQuerySpellCheckSuggestions: true },
        }

        const command = new RetrieveCommand(inputKendra);
        const response = await client.send(command);
        const queries = response.ResultItems?.map((item) => {
            return "\n Title: " + item.DocumentTitle + "\n URI: " + item.DocumentURI + "\n Confidence level: " + item.ScoreAttributes?.ScoreConfidence + "\n Content: " + item.Content
        })
        return queries?.join('\n')
    } catch (error) {
        console.log(error);
        return "Exception: Assistant is not available. Please try after some time.";
    }
}

async function executeBedrockAPI(query) {
    try {

        const configBR = { region: "ap-south-1" }
        const clientBR = new BedrockRuntimeClient(configBR);
        const inputBR = {
            modelId: "mistral.mixtral-8x7b-instruct-v0:1", //"mistral.mistral-7b-instruct-v0:2",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                prompt: query,
                max_tokens: 2000,
                temperature: 0.5,
                top_k: 200,
                top_p: 1,
                stop: ["Human"]
            }),
        };
        const commandBR = new InvokeModelCommand(inputBR);
        const response = await clientBR.send(commandBR);

        let decoder = new TextDecoder();
        let responseObject = decoder.decode(response.body);
        const textObj = JSON.parse(responseObject).outputs;
        console.log(textObj[0].text.replace(/^\s+|\s+$/g, ''));
        return textObj[0].text.replace(/^\s+|\s+$/g, '');
    } catch (err) {
        console.log(err);
        return "Exception: Error fetching results from LLM. Please try after some time.";
    }
}

async function executeBedrockStreamingAPI(query) {
    try {

        const configBR = { region: "ap-south-1" }
        const clientBR = new BedrockRuntimeClient(configBR);
        const inputBR = {
            modelId: "mistral.mixtral-8x7b-instruct-v0:1", //"mistral.mistral-7b-instruct-v0:2",
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                prompt: query,
                max_tokens: 2000,
                temperature: 0.5,
                top_k: 200,
                top_p: 1,
                stop: ["Human"]
            }),
        };

        const command = new InvokeModelWithResponseStreamCommand(inputBR);

        const response = await clientBR.send(command);

        return response;

    } catch (err) {
        console.error("Error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "An error occurred while processing the request" })
        };
    }

}

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
    console.log(response);
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
    //console.log(response);
    return response.Items;

}

function extractFirstJSON(outputStr) {
    console.log("Extracting JSON from: " + outputStr)
    const start = outputStr.indexOf('{')
    if (start >= 0) {
        const end = outputStr.indexOf('}')
        const finalOutput = outputStr.substring(start, end + 1)
        return JSON.parse(finalOutput)
    } else {
        return {}
    }
}

function llmPrompt(type, company, chatbotName, qnaHistory, query, nextQuery, kendraRetrieveResponse) {
    let prompt = "";
    switch (type) {
        case "FIRST_PROMPT":
            prompt =
                `
[INST]
You will be acting as a customer care chatbot for a ${company}. ${chatbotName ? "Your name is '" + chatbotName + "'. " : ""}Your goal is to assist customers by answering their questions and addressing their needs to the best of your ability, using information from the company's website.

This is a first step of 2-step chain of thoughts. In this step, you'll respond to only Greeting or Compliment messages. For any Human query, don't answer any question from your own knowledge. Read the following query from Human and determine:
- If human query is a Greeting message (Hi, Hello, How are you, etc.) or a Compliment (Thank you, great, awesome, you can do better etc.), then respond to it in a polite and humble way as a Customer care executive for a Government department in following JSON format:  {"context": "greeting", "response": "<humble response to the query>" }. 
- If human query is a follow up question to the previous conversation history shared below inside <ConversationHistory></ConversationHistory> tags, then update the human query with relevant context from <ConversationHistory></ConversationHistory> to prepare a better search query for knowledgebase. Don't try to answer the query yet, instead send response in JSON format: {"context": "follow-up", "response": "<Updated human query with relevant context>" }.
- If human query is a new query with no dependency on previous history, respond as follows: {"context": "new-query", "response": "<Return user query without modification>" }.

    <ConversationHistory>
      ${qnaHistory}
    </ConversationHistory>

Validate and reconfirm whether you have selected the right option. Double check that "context" in response JSON has one of the following values: "greeting", "new-query" or "follow-up". Validate that you are sharing a valid JSON. Only share a single JSON response without any additional explanation or text. IMPORTANT: ONLY RETURN RESPONSE IN JSON FORMAT AND NOTHING ELSE. DON'T TRY TO ANSWER ANY QUESTION FROM YOUR OWN KNOWLEDGEBASE.
[/INST] 

Human: ${query} 
AI: `
            break;
        case "SECOND_PROMPT":
            prompt = `
[INST] 
You will be acting as a customer care chatbot for a ${company}. ${chatbotName ? "Your name is '" + chatbotName + "'. " : ""}Your goal is to assist customers by answering their questions and addressing their needs to the best of your ability, using information from the company's website.

This is the second step of 2-step chain of thoughts. Here are some important guidelines to follow during the conversation:
- Respond to Human's query from the relevant information encapsulated within <context></context> tags ONLY.
- If the customer's query cannot be satisfactorily answered using the information in the <context></context> tags, apologize and politely explain that you don't have the necessary information to assist them with that particular request.
- Avoid engaging with any queries that use foul language, are political in nature, or are otherwise inflammatory or inappropriate. Politely state that you are not able to discuss those topics.
- Do not attempt to answer any questions that would require information from outside the provided knowledgebase. Your knowledge is strictly limited to what is in the knowledgebase.
- Prioritize recent information for generating response. Include the relevant date from context for old messages at the end of <user-friendly answer>: 'Note: The information is based on data from <DATE>, and may be outdated today. For the latest information, refer to the ${company} website.' In case of no date found in context, add a disclaimer at the end of <user-friendly answer>: 'Note: No date has been mentioned in the source, please validate the latest information on ${company} portal.'
- Response must strictly adhere to this JSON format, ensuring no non-JSON elements are included:
{ 
  "response": "<user-friendly answer>", 
  "sourceAttributions": [
    { "title": "<source document title>", 
      "url": "<source URL>"
    }
  ] 
}

<context>
  ${kendraRetrieveResponse}
</context>

Validate and reconfirm that you are sharing a valid JSON. Only share a single JSON response without any additional explanation or text. IMPORTANT: ONLY RETURN RESPONSE IN JSON FORMAT AND NOTHING ELSE. DON'T TRY TO ANSWER ANY QUESTION FROM YOUR OWN KNOWLEDGEBASE.
[/INST]

Human: ${nextQuery ? nextQuery : query}
AI: 
`
            break;
    }
    //console.log(prompt);
    return prompt
}

//eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU3Mjg0ZGJhLWQzMzMtNDRlMC1iMjE2LWI0Y2M0ZjJkZDNjNCIsImN1c3RvbWVyIjoiUGFzc3BvcnQtU2V2YSIsIndlYnNpdGUiOiJodHRwczovL3d3dy5wYXNzcG9ydGluZGlhLmdvdi5pbi8iLCJhZGRpdGlvbmFsX3NpdGVzIjpbXSwiY2hhdGJvdG5hbWUiOiJQYXNzcG9ydCBTZXZhayIsImNoYXRib3RfbG9nb191cmwiOm51bGwsImluaXRpYWxfdGV4dCI6IkhlbGxvLCBJIGFtIFFDaGF0LiBIb3cgY2FuIEkgaGVscCB5b3U_IiwiZ3VhcmRyYWlscyI6IllvdSBhcmUgYSBwb2xpdGUgYW5kIGhvbmVzdCBjaGF0Ym90LCB3aG8gcmVzcG9uZHMgdG8gcXVlcmllcyB3aXRoIGVtcGF0aHkuIiwiYWNjZXB0VG5DIjp0cnVlLCJkb2NzIjpudWxsLCJib3Rfc3RhdHVzIjpudWxsLCJxY2hhdGZvcm1fc3RhdHVzIjoiQ29tcGxldGVkIiwicmVnaW9uUSI6Ik5PUlRIX1ZJUkdJTklBIiwiZXhwaXJ5X2RhdGV0aW1lIjpudWxsLCJyZXF1ZXN0ZXJfZW1haWwiOiJ0aXd2aWthQGFtYXpvbi5jb20iLCJhcHBsaWNhdGlvbklkUSI6IjU4NDU1MWY1LWVhOWUtNGQ2ZC04ODA1LTVlZDk0ZTAyZjc2ZSIsImluZGV4ZWRQYWdlcyI6IjkwMiIsImNyZWF0ZWRBdCI6IjIwMjQtMDgtMDJUMDQ6NTM6MTAuNjc3WiIsInVwZGF0ZWRBdCI6IjIwMjQtMDgtMDJUMTA6NTQ6MzEuMzc1WiIsImlhdCI6MTcyMzA0Nzc3NCwiZXhwIjoxNzIzNjUyNTc0fQ.zil5XDchn0-DqSQn3tVZm_21FGgPgWtobPGSBsjdgYQ
//curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjU3Mjg0ZGJhLWQzMzMtNDRlMC1iMjE2LWI0Y2M0ZjJkZDNjNCIsImN1c3RvbWVyIjoiUGFzc3BvcnQtU2V2YSIsIndlYnNpdGUiOiJodHRwczovL3d3dy5wYXNzcG9ydGluZGlhLmdvdi5pbi8iLCJhZGRpdGlvbmFsX3NpdGVzIjpbXSwiY2hhdGJvdG5hbWUiOiJQYXNzcG9ydCBTZXZhayIsImNoYXRib3RfbG9nb191cmwiOm51bGwsImluaXRpYWxfdGV4dCI6IkhlbGxvLCBJIGFtIFFDaGF0LiBIb3cgY2FuIEkgaGVscCB5b3U_IiwiZ3VhcmRyYWlscyI6IllvdSBhcmUgYSBwb2xpdGUgYW5kIGhvbmVzdCBjaGF0Ym90LCB3aG8gcmVzcG9uZHMgdG8gcXVlcmllcyB3aXRoIGVtcGF0aHkuIiwiYWNjZXB0VG5DIjp0cnVlLCJkb2NzIjpudWxsLCJib3Rfc3RhdHVzIjpudWxsLCJxY2hhdGZvcm1fc3RhdHVzIjoiQ29tcGxldGVkIiwicmVnaW9uUSI6Ik5PUlRIX1ZJUkdJTklBIiwiZXhwaXJ5X2RhdGV0aW1lIjpudWxsLCJyZXF1ZXN0ZXJfZW1haWwiOiJ0aXd2aWthQGFtYXpvbi5jb20iLCJhcHBsaWNhdGlvbklkUSI6IjU4NDU1MWY1LWVhOWUtNGQ2ZC04ODA1LTVlZDk0ZTAyZjc2ZSIsImluZGV4ZWRQYWdlcyI6IjkwMiIsImNyZWF0ZWRBdCI6IjIwMjQtMDgtMDJUMDQ6NTM6MTAuNjc3WiIsInVwZGF0ZWRBdCI6IjIwMjQtMDgtMDJUMTA6NTQ6MzEuMzc1WiIsImlhdCI6MTcyMzA0Nzc3NCwiZXhwIjoxNzIzNjUyNTc0fQ.zil5XDchn0-DqSQn3tVZm_21FGgPgWtobPGSBsjdgYQ" "http://localhost:4000/stream?chat=%7B%22conversationId%22%3A%22%22%2C%22parentMessageId%22%3A%22%22%2C%22userMessage%22%3A%22Tell%20me%20about%20Passport%22%2C%22clientToken%22%3A%2250bd7692-ed5e-4e9a-b662-637eefe9048c%22%7D"