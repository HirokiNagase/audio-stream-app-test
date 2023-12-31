# Audio Chat App

## Overview

This Audio Chat App is an interactive web application enabling users to record audio messages, convert them to text using OpenAI's Whisper API, and receive responses generated by OpenAI's GPT models. The app also converts these text responses back to audio using OpenAI's Text-to-Speech API. Users can join or create rooms to have these audio-text conversations.

## Features

- Audio Recording: Users can record their voice and send the audio to the server.
- Text Conversion: Recorded audio is converted to text using the Whisper model.
- AI Responses: The text is processed by GPT models to generate relevant responses.
- Text-to-Speech: Responses from the AI are converted back into audio for a seamless user experience.

## Setup and Installation

Follow these steps to set up your environment:

1. **Copy Environment File**  
   Execute the following command to copy the example environment file:

   ```sh
   cp .env.example .env
   ```

2. **Create Supabase and OpenAI Accounts**  
   Sign up for accounts on [Supabase](https://supabase.io/) and [OpenAI](https://openai.com/). Additionally, create a project in Supabase.

3. **Fill in the .env File**  
   Edit the `.env` file and fill in all the required fields with your specific credentials and settings.

4. **Database Migration**  
   Run the following command to create your database structure using Prisma:

   ```sh
   yarn
   yarn prisma migrate dev
   ```

5. **Start the Application**  
   Start the application by running:
   ```sh
   yarn start
   ```
