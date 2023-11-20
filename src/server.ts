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
      await supabase.from("messages").insert([
        {
          roomId,
          userType: "user",
          content: response.text,
        },
      ]);
      res.json({ success: true, convertedText: response.text });
    } catch (error) {
      console.error("Error processing audio:", error);
      res.status(500).send("音声処理中にエラーが発生しました。");
    }
  }
);

app.post("/api/request-ai-response", async (req: Request, res: Response) => {
  const { roomId, text, history } = req.body;
  try {
    // 会話履歴を整形
    const formattedHistory = history.map((message: any) => {
      return {
        role: message.userType === "user" ? "user" : "assistant",
        content: message.content,
      };
    });

    // AIによる応答を取得
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant. Please keep your reply to 140 characters or less in Japanese.",
        },
        ...formattedHistory,
        { role: "user", content: text },
      ],
    });
    const response = chatResponse.choices[0].message.content;

    // 応答をデータベースに保存
    await supabase.from("messages").insert([
      {
        roomId,
        userType: "ai_response",
        content: response,
      },
    ]);

    const speechData = await convertTextToSpeech(response!);

    // 応答をクライアントに返す
    res.json({
      success: true,
      response: response,
      audio: speechData.toString("base64"),
    });
  } catch (error) {
    console.error("Error processing AI response:", error);
    res.status(500).send("AI応答処理中にエラーが発生しました。");
  }
});

async function convertTextToSpeech(text: string) {
  const response = await openai.audio.speech.create({
    model: "tts-1",
    input: text,
    voice: "nova",
    response_format: "opus",
  });

  return Buffer.from(await response.arrayBuffer());
}

const PORT: number = 3000;
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
