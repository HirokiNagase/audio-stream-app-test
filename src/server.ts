import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { OpenAIApi, Configuration } from "openai";

const app: express.Application = express();
const server: http.Server = http.createServer(app);
const io: Server = new Server(server);

// OpenAI APIの設定
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY, // 環境変数からAPIキーを取得
});
const openai = new OpenAIApi(configuration);

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

    // Whisper APIを使用して文字起こし
    try {
      const response = await openai.createTranscription({
        model: "whisper-1", // モデル指定
        file: fs.createReadStream(convertedFilePath), // ファイル読み込み
      });
      console.log(response.text); // 文字起こし結果の表示
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
