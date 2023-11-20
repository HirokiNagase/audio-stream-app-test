import express, { Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
import supabase from "../supabese";
import { v4 as uuidv4 } from "uuid";
import multer from "multer";
dotenv.config();

const app: express.Application = express();
const server: http.Server = http.createServer(app);
const io: Server = new Server(server);
app.use(express.json());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // 保存場所の設定
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + ".webm");
  },
});

const upload = multer({ storage: storage });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../../index.html"));
});

app.post("/api/join-room", async (req, res) => {
  const { roomId } = req.body;
  try {
    const { data: roomData, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("name", roomId)
      .single();

    if (roomError) throw roomError;
    if (!roomData) {
      res.json({ success: false });
    } else {
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("roomId", roomData.id);

      if (messagesError) throw messagesError;

      res.json({ success: true, room: roomData, messages: messagesData });
    }
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send(err);
  }
});

app.post("/api/create-room", async (req, res) => {
  try {
    const roomName = uuidv4();

    // 新しいルームを挿入
    const insertResult = await supabase
      .from("rooms")
      .insert([{ name: roomName }]);

    if (insertResult.error) throw insertResult.error;

    // 挿入されたルームを名前で検索して取得
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("name", roomName)
      .single();

    if (error) throw error;

    res.json({ success: true, room: data });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("サーバーエラー");
  }
});

app.post(
  "/api/process-audio",
  upload.single("audio"),
  async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).send("音声ファイルがありません。");
    }
    const roomId = req.body.roomId; // リクエストからルームIDを取得
    const history = req.body.history
      ? JSON.parse(req.body.history as string)
      : [];
    const formattedHistory = history.map((message: any) => {
      return {
        role: message.userType === "user" ? "user" : "assistant",
        content: message.content,
      };
    });

    try {
      // ディスクに保存されたファイルのパス
      const filePath = path.resolve(
        __dirname,
        "../../uploads",
        req.file.filename
      );

      // ReadStreamを作成
      const fileStream = fs.createReadStream(filePath);
      // Whisper APIを使用してテキストに変換

      const response = await openai.audio.transcriptions.create({
        model: "whisper-1",
        file: fileStream,
      });

      fs.unlinkSync(filePath);
      const insertMessagePromise = supabase.from("messages").insert([
        {
          roomId,
          userType: "user",
          content: response.text,
        },
      ]);

      const chatResponsePromise = openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Please keep your reply to 140 characters or less in Japanese.",
          },
          ...formattedHistory, // 会話の履歴を含める
          { role: "user", content: response.text }, // Whisper APIのテキストを含める
        ],
      });

      const [_insertMessage, chatResponse] = await Promise.all([
        insertMessagePromise,
        chatResponsePromise,
      ]);
      // 新規で作成された返答をDBに保存
      const responseText = chatResponse.choices[0].message.content;
      await supabase.from("messages").insert([
        {
          roomId,
          userType: "ai_response",
          content: responseText,
        },
      ]);
      const history = [
        {
          userType: "user",
          content: response.text,
        },
        {
          userType: "ai_response",
          content: responseText,
        },
      ];

      res.json({ success: true, history });
    } catch (error) {
      console.error("Error processing audio:", error);
      res.status(500).send("音声処理中にエラーが発生しました。");
    }
  }
);

const PORT: number = 3000;
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});

// AIモデルに問い合わせる関数（仮の実装）
async function askAI(userText: string) {
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    messages: [
      {
        role: "system",
        content:
          "You are a kind assistant. Please keep it under 140 characters in Japanese.",
      },
      { role: "user", content: userText },
    ],
  });
  return completion.choices[0].message.content;
}
