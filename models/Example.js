import mongoose from "mongoose";

const ExampleSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    label: { type: String, enum: ["positive","negative","neutral"], required: true }
  },
  { timestamps: true }
);

export const Example = mongoose.model("Example", ExampleSchema);
