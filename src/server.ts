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
      //   const response = {
      //     text: "こんにちは。プログラミングの勉強をしようと思っています。まずはどこから勉強すればいいでしょうか?",
      //   };
      socket.emit("transcription", response.text);
      //   const responce = Math.random().toString(32).substring(2);
      //   socket.emit("transcription", responce);
      const aiResponse = await askAI(response.text); // AIモデルに問い合わせる関数
      socket.emit("ai_response", aiResponse);
    } catch (error) {
      console.error("Error in transcription:", error);
    }
  });
});

const PORT: number = 3000;
server.listen(PORT, () => {
  console.log(`Listening on *:${PORT}`);
});

// AIモデルに問い合わせる関数（仮の実装）
async function askAI(userText: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    messages: [
      {
        role: "system",
        content: "You are a kind assistant. Please respond in Japanese.",
      },
      { role: "user", content: userText },
    ],
  });
  return completion.choices[0].message.content;
}
