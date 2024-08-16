const { executeBedrockAPI, executeBedrockStreamingAPI } = require('./bedrock-services');
const { retrieveKendraSearch } = require('./kendra-retrieval');
const { mutateConversation, queryConversastion } = require('./conversation-services');
const { llmPrompt, extractFirstJSON } = require('./prompt-utils');
const { responseStreaming } = require('./response-streaming');
const { textToSpeechStream } = require('./tts-polly');

async function chat(userMsg, decodedToken, res, isSpeakerEnabled) {
    let textResponse;
    let attributions = [];
    let qnaHistory = '';
    let nextQuery = '';
    var messageId = '';
    var conversationId = '';

    try {
        const { userMessage: query, conversationId: convId } = JSON.parse(userMsg);
        conversationId = convId;

        if (conversationId) {
            const conversationHistory = await queryConversastion(conversationId);
            qnaHistory = conversationHistory?.map((item) => `Query: ${item.question} \nResponse: ${item.response}`).join('\n') || '';
        }

        const handleGreetingsPrompt = llmPrompt("FIRST_PROMPT", decodedToken.customer, decodedToken.chatbotName, qnaHistory, query, "", "")
        const respLLM = await executeBedrockAPI(handleGreetingsPrompt)
        const firstLLMResponse = extractFirstJSON(respLLM);

        if (firstLLMResponse?.context == "greeting") {
            textResponse = firstLLMResponse.response
            const resultFirstConvMutation = await mutateConversation(conversationId, query, "", textResponse, decodedToken)
            messageId = resultFirstConvMutation.messageId
            conversationId = resultFirstConvMutation.conversationId
        } else if (firstLLMResponse?.context == "new-query") {
            nextQuery = ""
        } else if (firstLLMResponse?.context == "follow-up") {
            nextQuery = firstLLMResponse.response
        }

        if (firstLLMResponse?.context == "new-query" || firstLLMResponse?.context == "follow-up") {
            const kendraRetrieveResponse = await retrieveKendraSearch(nextQuery ? nextQuery : query, decodedToken.applicationIdQ)

            if (!kendraRetrieveResponse) {
                var outputResponse = {
                    conversationId,
                    failedAttachments: [],
                    sourceAttributions: [],
                    systemMessage: "Sorry, I couldn't find any relevant information.",
                    systemMessageId: '',
                    userMessageId: '',
                };
            } else {
                const fullPrompt = llmPrompt("SECOND_PROMPT", decodedToken.customer, decodedToken.chatbotName, qnaHistory, query, nextQuery, kendraRetrieveResponse)
                const response = await executeBedrockStreamingAPI(fullPrompt)

                const outputBR = await responseStreaming(response, res)

                textResponse = outputBR.response?.trim();
                attributions = outputBR.sourceAttributions?.
                    filter(function (v, i, self) {
                        return i == self.indexOf(v);
                    })

                const resultConvMutation = await mutateConversation(conversationId, query, nextQuery || "", textResponse, decodedToken)
                messageId = resultConvMutation.messageId
                conversationId = resultConvMutation.conversationId

                var outputResponse = {
                    conversationId: conversationId,
                    failedAttachments: [],
                    sourceAttributions: attributions,
                    systemMessage: textResponse,
                    systemMessageId: messageId,
                    userMessageId: '',
                };
            }

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

        if (isSpeakerEnabled == "true") {
            //Start TTS
            res.write('data: [AUDIO]\n\n');
            await textToSpeechStream(outputResponse.systemMessage, res);
            //res.write('data: [END]\n\n');
            //res.end();
        } else {
            res.write('data: [END]\n\n');
            res.end();
        }

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

module.exports = { chat }