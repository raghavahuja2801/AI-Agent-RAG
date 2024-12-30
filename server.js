import express from "express";
import bodyParser from "body-parser";
import twilio from "twilio";
import { getOpenAIResponse, conversationHistory } from "./openai.js";
import axios from "axios";

// Initialize Express app
const app = express();
app.use(bodyParser.urlencoded({ extended: false })); // Add this
app.use(bodyParser.json());


// Twilio credentials
const TWILIO_ACCOUNT_SID = process.env.TWILIO_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_API_KEY;
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const VoiceResponse = twilio.twiml.VoiceResponse;


app.post("/start", async (req, res) => {
    try {

        // Generate TwiML response
        const twiml = new VoiceResponse();

        // Speak a prompt to the user
        twiml.say({ voice: 'Polly.Joanna', language: 'en-US' }, "Hi, Thank You for calling Sonu Barbers, How can I help you today?");

        // Gather user's input (wait for speech input)
        twiml.gather({
            input: 'speech', // Listen for speech
            speechTimeout: 1,    // Wait for up to 2 seconds for user input
            action: '/voice', // Redirect back to the same endpoint to keep listening
            method: 'POST',
        });

        // Send the TwiML response
        res.type("text/xml").send(twiml.toString());
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("An error occurred");
    }
});


app.post("/voice", async (req, res) => {
    try {
        const userMessage = req.body.SpeechResult || "No input received";
        const userNumber = req.body.From || "Unknown number";
        console.log(req.body);
        console.log("User said:", userMessage);

        // Append user message to conversation
        conversationHistory.push({ role: "user", content: userMessage });

        // Get GPT answer, with Pinecone context
        const botResponse = await axios.post("https://ozafa.app.n8n.cloud/webhook-test/bfc22c1f-efb1-4acf-8f5e-e7a734ead310",{userMessage:userMessage, userNumber:userNumber});
        console.log(botResponse.data);
    

        // Add the assistant's response to conversation
        conversationHistory.push({ role: "assistant", content: botResponse.data });

        // Generate TwiML response
        const twiml = new VoiceResponse();

        // Speak the bot's response
        twiml.say({ voice: 'Polly.Joanna', language: 'en-US' }, botResponse.data);

        // Immediately start listening for user input after speaking
        twiml.gather({
            input: 'speech',  // Listen for speech input
            speechTimeout: 1, // Wait for speech input immediately after the bot stops speaking
            action: '/voice', // Redirect back to the same endpoint to keep listening
            method: 'POST',   // Use POST method to gather response
        });

        // Send the TwiML response
        res.type("text/xml").send(twiml.toString());
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("An error occurred");
    }
});

  

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
