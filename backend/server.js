require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI, {
  dbName: "collegeDB"
})
.then(() => console.log("MongoDB connected"))
.catch(err => console.log(err));

const Student = mongoose.model(
  "Student",
  {
    name: String,
    age: Number,
    course: String
  },
  "Students"
);

app.get("/students", async (req, res) => {
  const students = await Student.find();
  res.json(students);
});

app.listen(3000, () => {
  console.log("Backend running on port 3000");
});