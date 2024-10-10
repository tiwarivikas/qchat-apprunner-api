const { extractFirstJSON } = require('./prompt-utils');

async function responseStreaming(streamResponse, res) {
    try {
        res.write('data: [START]\n\n');

        let tmpResponse = ""
        let blnResponseStarted = false
        let blnResponseFinished = false
        let tmpResponseTextOnly = ""

        for await (const event of streamResponse.body) {
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
                    const startIndex =
                      tmpResponse.indexOf('"response": "') + 13;
                    const responseSubstring = tmpResponse.substring(startIndex);
                    res.write(`data: ${responseSubstring}\n\n`);
                    tmpResponseTextOnly =
                      tmpResponseTextOnly + responseSubstring;
                }
            }
        };
        const extractedJSON = extractFirstJSON(tmpResponse);
        return extractedJSON.response ? extractedJSON : { response: tmpResponseTextOnly };
    } catch (error) {
        console.log(error)
        return { response: tmpResponseTextOnly };
    }
}


module.exports = { responseStreaming }