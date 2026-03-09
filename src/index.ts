import "dotenv/config";
import express from "express";
import { identifyHandler } from "./identify";

const app = express();
app.use(express.json());

app.post("/identify", identifyHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
