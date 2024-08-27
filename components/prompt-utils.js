function extractFirstJSON(outputStr) {
    try {
        console.log("Extracting JSON from: " + outputStr)
        const start = outputStr.indexOf('{')
        if (start >= 0) {
            const end = outputStr.lastIndexOf('}')
            const finalOutput = outputStr.substring(start, end + 1)
            return JSON.parse(finalOutput)
        } else {
            return {}
        }
    } catch (err) {
        console.log(err)
        return {}
    } 
}


function llmPrompt(
  type,
  company,
  chatbotName,
  qnaHistory,
  query,
  nextQuery,
  kendraRetrieveResponse,
  isSpeakerEnabled
) {
  let prompt = "";
  switch (type) {
    case "FIRST_PROMPT":
      prompt = `
[INST]
You will be acting as a customer care chatbot for a ${company}. ${
        chatbotName ? "Your name is '" + chatbotName + "'. " : ""
      }Your goal is to assist customers by answering their questions and addressing their needs to the best of your ability, using information from the company's website.

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
AI: `;
      break;
    case "SECOND_PROMPT":
      prompt = `
[INST] 
You will be acting as a customer care chatbot for a ${company}. ${
        chatbotName ? "Your name is '" + chatbotName + "'. " : ""
      }Your goal is to assist customers by answering their questions and addressing their needs to the best of your ability, using information from the company's website.

This is the second step of 2-step chain of thoughts. Here are some important guidelines to follow during the conversation:
- Respond to Human's query from the relevant information encapsulated within <context></context> tags ONLY.
- If the customer's query cannot be satisfactorily answered using the information in the <context></context> tags, apologize and politely explain that you don't have the necessary information to assist them with that particular request.
- Avoid engaging with any queries that use foul language, are political in nature, or are otherwise inflammatory or inappropriate. Politely state that you are not able to discuss those topics.
- Do not attempt to answer any questions that would require information from outside the provided knowledgebase. Your knowledge is strictly limited to what is in the knowledgebase.
    ${
      isSpeakerEnabled == "true"
        ? "- Be precise to provide response in less than 50 words."
        : "- Prioritize recent information for generating response. Include the relevant date from context for old messages within the <user-friendly answer> response: 'Note: The information is based on data from <DATE>, and may be outdated today. For the latest information, refer to the ${company} website.' In case of no date found in context, add a disclaimer within the <user-friendly answer> response: 'Note: No date has been mentioned in the source, please validate the latest information on ${company} portal.'"
    }
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
`;
      break;
  }
  //console.log(prompt);
  return prompt;
}

module.exports = {llmPrompt, extractFirstJSON}
