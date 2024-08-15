const { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } = require("@aws-sdk/client-bedrock-runtime");

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

module.exports =  {executeBedrockAPI, executeBedrockStreamingAPI}