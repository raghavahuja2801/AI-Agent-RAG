import OpenAI from "openai";
import { Pinecone } from '@pinecone-database/pinecone'
import { functions, getAvailableTimeSlots, bookTimeSlot  } from "./functions.js";
import { conversationGuidelines } from "./Prompt.js";

// Config OpenAI client
const openai = new OpenAI({ apiKey: "ADD YOU API KEY HERE" });

// ---------- PINECONE SETUP -----------
const pc = new Pinecone({ apiKey: "ADD YOUR API KEY HERE" })
// To get the unique host for an index, 
// see https://docs.pinecone.io/guides/data/target-an-index
const index = pc.index("anidea", "https://anidea-snq73wo.svc.aped-4627-b74a.pinecone.io")



const conversationHistory = [
    { role: "system", content: conversationGuidelines },
];


// 2) Query Pinecone for relevant context
async function getRelevantContext(userMessage, topK = 3) {


    // Embed the user query
    const queryEmbedding = await embedTextForSearch(userMessage);

    // Perform similarity search in Pinecone
    // We fetch the top-k most similar chunks
    const queryResponse = await index.query({
        vector: queryEmbedding,
        topK,
        includeValues: false,      // we usually just need metadata
        includeMetadata: true
    });

    // Extract relevant text from metadata
    const matches = queryResponse.matches || [];
    const retrieved = matches.map((match) => {
        // In your upserts, you probably stored 'prompt' or 'text' in 'metadata'
        return match.metadata.prompt ?? match.metadata.text ?? "";
    });

    // Combine them into a single context string
    const context = retrieved.join("\n\n");
    return context;
}


// 1) We'll need a helper to embed user messages
async function embedTextForSearch(text) {
    // We'll use text-embedding-ada-002. 
    // Make sure the dimension matches your Pinecone index dimension (1536).
    const response = await openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text
    });
    return response.data[0].embedding;
}

// 5. The function that orchestrates the "ask GPT" flow,
//    including logic to handle function calls:
async function getOpenAIResponse(conversationHistory) {
    // 1) Extract the latest user message
    const userMessage = conversationHistory
      .slice()
      .reverse()
      .find((msg) => msg.role === "user")?.content || "No user message found.";
  
    // 2) (Optional) Retrieve context from Pinecone
    const context = await getRelevantContext(userMessage);
  
    // 3) Build an augmented conversation with context
    const augmentedHistory = [
      // Keep your original system prompt
      conversationHistory[0],
  
      // Insert "knowledge base" context as a system message
      {
        role: "system",
        content: `Relevant context from our knowledge base:\n${context}`
      },
  
      // Then the rest of the conversation
      ...conversationHistory.slice(1)
    ];
  
    // 4) First call to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",  // or "gpt-3.5-turbo-0613"
      messages: augmentedHistory,
      functions,
      function_call: "auto"
    });
  
    const firstChoice = response.choices[0];
  
    // 5) Check if GPT wants to call a function
    if (firstChoice.finish_reason === "function_call") {
      const { name, arguments: argsJSON } = firstChoice.message.function_call;
  
      // Parse the arguments from JSON
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(argsJSON);
      } catch (err) {
        console.warn("Could not parse function call arguments:", err);
      }
  
      let functionResult;
  
      // 6) Run the matching local function
     
      if (name === "getAvailableTimeSlots") {
        console.log(parsedArgs);
        functionResult = getAvailableTimeSlots(parsedArgs.calendarId, parsedArgs.startDate, parsedArgs.endDate, parsedArgs.durationMinutes);
        console.log(functionResult);
      }else if (name === "bookTimeSlot") {
        console.log(parsedArgs);
        functionResult = bookTimeSlot(parsedArgs.calendarId, parsedArgs.eventSummary, parsedArgs.eventDescription, parsedArgs.startDate, parsedArgs.endDate, parsedArgs.durationMinutes, parsedArgs.timeZone);
      }
       else {
        functionResult = "Unknown function requested.";
      }
  
      // 7) Build a new "function" message with the result
      const functionResponseMessage = {
        role: "function",
        name,
        content: JSON.stringify(functionResult)
      };
  
      // 8) Make a second call to OpenAI, passing the function’s output
      const secondResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          ...augmentedHistory,
          firstChoice.message,       // The assistant's function_call message
          functionResponseMessage    // Our function result
        ]
      });
  
      // The final text after factoring in the function result
      const finalText = secondResponse.choices[0].message.content;
      return finalText;
    } else {
      // If no function call, just return the normal text response
      return firstChoice.message.content;
    }
  }


export { getOpenAIResponse, conversationHistory };