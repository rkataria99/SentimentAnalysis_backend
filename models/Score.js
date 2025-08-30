import mongoose from "mongoose";

const ScoreSchema = new mongoose.Schema(
  {
    name: { type: String, default: "Anonymous" },
    score: { type: Number, required: true },
    total: { type: Number, required: true }
  },
  { timestamps: true }
);

export const Score = mongoose.model("Score", ScoreSchema);
