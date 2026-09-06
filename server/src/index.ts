import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import chatRoute from "./routes/chat";
import githubRoute from "./routes/github";
import chatsRoute from "./routes/chats";
import usageRoute from "./routes/usage";
import authRoute from "./routes/auth";
import { attachUser } from "./middleware/auth";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

app.get("/", (req, res) => {
  res.json({ status: "AI GitHub Agent server is running 🚀" });
});

app.use("/auth", authRoute);
app.use("/api/chat", chatRoute);
app.use("/api/github", githubRoute);
app.use("/api/chats", chatsRoute);
app.use("/api/usage", usageRoute);

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
