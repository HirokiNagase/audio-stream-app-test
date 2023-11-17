import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const app: express.Application = express();
const server: http.Server = http.createServer(app);
const io: Server = new Server(server);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../index.html"));
});

io.on("connection", (socket) => {
  socket.on("audio", async (audioBlob: Buffer) => {
    const convertedFilePath = path.join(
      __dirname,
      "../converted/converted_audio.webm"
    );
    fs.writeFileSync(convertedFilePath, audioBlob);
    console.log("file created");

    try {
      const response = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: fs.createReadStream(convertedFilePath),
      });
      console.log(response.text);
      socket.emit("transcription", response.text);
    } catch (error) {
      console.error("Error in transcription:", error);
    }
  });
});

const PORT: number = 3000;
server.listen(PORT, () => {
  console.log(`Listening on *:${PORT}`);
});
