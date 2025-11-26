import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import Joi from "joi";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const schema = Joi.object({ name: Joi.string().required() });

app.post("/echo", (req, res) => {
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: `Hello ${value.name}` });
});

app.listen(3001, () => console.log("Express listening on 3001"));