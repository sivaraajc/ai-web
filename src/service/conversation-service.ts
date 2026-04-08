import { Injectable } from '@angular/core';
import { CohereClient } from 'cohere-ai';

@Injectable({
  providedIn: 'root',
})
export class ConversationService { private cohere = new CohereClient({
    token: "QMjbSOIpYq4pu49Exdo0XqHhRDTWN53QtbjQYcWb", 
  });
  
  constructor() { }
  
  async chat(message: string): Promise<string> {
    try {
      const stream = await this.cohere.chatStream({
        model: "command-r-08-2024",
        message: message,
        temperature: 0.3,
        chatHistory: [], // Keep it empty as per your request
        promptTruncation: "OFF", // Set to OFF to match the desired payload
        connectors: [], // No connectors specified
        responseFormat: { type: "text" } // Specify response format
      });
  
      let response = '';
      for await (const chat of stream) {
        if (chat.eventType === "text-generation") {
          response += chat.text; // Accumulate the response text
        }
      }
  
      return response; // Return the accumulated response
    } catch (error) {
      console.error('Error during API call', error);
      return 'Error in AI response'; // Return a friendly error message
    }
  }
}
