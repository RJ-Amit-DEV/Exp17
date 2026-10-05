require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(
  cors({
    origin: true,
    credentials: false
  })
);

app.use(express.json({ limit: "2mb" }));

// ======================================================
// HELPERS
// ======================================================

const makeId = () => crypto.randomUUID();

function hashValue(value, salt) {
  return crypto
    .createHash("sha256")
    .update(`${salt}:${value}`)
    .digest("hex");
}

function createCodeHash(code) {
  const salt = crypto.randomBytes(16).toString("hex");

  return {
    salt,
    hash: hashValue(code, salt)
  };
}

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  const salt = crypto.randomBytes(16).toString("hex");

  return {
    token,
    salt,
    hash: hashValue(token, salt)
  };
}

function getSessionExpiry() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  return expiry;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

// ======================================================
// SCHEMAS
// ======================================================

const teacherSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    codeSalt: {
      type: String,
      required: true
    },

    codeHash: {
      type: String,
      required: true
    },

    sessionSalt: {
      type: String,
      default: ""
    },

    sessionHash: {
      type: String,
      default: ""
    },

    sessionExpiresAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

const columnSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true
    },

    label: {
      type: String,
      required: true,
      trim: true
    },

    type: {
      type: String,
      enum: ["status", "number", "text"],
      default: "text"
    },

    maxMarks: {
      type: Number,
      default: 0
    }
  },
  {
    _id: false
  }
);

const studentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true
    },

    rollNo: {
      type: String,
      default: ""
    },

    name: {
      type: String,
      default: ""
    },

    age: {
      type: Number,
      default: null
    },

    values: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    _id: false
  }
);

const batchSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true
    },

    name: {
      type: String,
      required: true
    },

    columns: {
      type: [columnSchema],
      default: []
    },

    students: {
      type: [studentSchema],
      default: []
    }
  },
  {
    _id: false
  }
);

const labSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      index: true,
      default: null
    },

    // Used only for migration of old data.
    legacyTeacherName: {
      type: String,
      default: ""
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    subject: {
      type: String,
      default: ""
    },

    batches: {
      type: [batchSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);

const Teacher = mongoose.model("Teacher", teacherSchema);
const Lab = mongoose.model("Lab", labSchema);

// ======================================================
// DEFAULT BATCH
// ======================================================

function defaultColumns() {
  return [
    {
      id: makeId(),
      label: "Experiments File",
      type: "status",
      maxMarks: 0
    },
    {
      id: makeId(),
      label: "Experiment Marks",
      type: "number",
      maxMarks: 20
    },
    {
      id: makeId(),
      label: "Assignments",
      type: "status",
      maxMarks: 0
    },
    {
      id: makeId(),
      label: "Assignment Marks",
      type: "number",
      maxMarks: 10
    }
  ];
}

function defaultBatch(name) {
  return {
    id: makeId(),
    name,
    columns: defaultColumns(),
    students: []
  };
}

// ======================================================
// BASIC ROUTES
// ======================================================

app.get("/", (req, res) => {
  res.json({
    message: "Exp17 Lab Management API is running"
  });
});

// ======================================================
// AUTHENTICATION
// ======================================================

app.post("/api/auth/login", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const code = String(req.body.code || "").trim();

    if (!name) {
      return res.status(400).json({
        message: "Teacher name is required"
      });
    }

    if (!/^\d{4}$/.test(code)) {
      return res.status(400).json({
        message: "Access code must contain exactly 4 digits"
      });
    }

    let teacher = await Teacher.findOne({ name });

    // --------------------------------------------------
    // NEW TEACHER
    // --------------------------------------------------

    if (!teacher) {
      const codeData = createCodeHash(code);

      teacher = await Teacher.create({
        name,
        codeSalt: codeData.salt,
        codeHash: codeData.hash
      });

      // ------------------------------------------------
      // Migrate old labs belonging to same teacher name
      // ------------------------------------------------

      await Lab.updateMany(
        {
          teacherId: null,
          legacyTeacherName: name
        },
        {
          $set: {
            teacherId: teacher._id
          }
        }
      );
    }

    // --------------------------------------------------
    // EXISTING TEACHER
    // --------------------------------------------------

    else {
      const enteredHash = hashValue(
        code,
        teacher.codeSalt
      );

      if (enteredHash !== teacher.codeHash) {
        return res.status(401).json({
          message: "Incorrect access code"
        });
      }
    }

    // --------------------------------------------------
    // CREATE SESSION
    // --------------------------------------------------

    const session = createSession();

    teacher.sessionSalt = session.salt;
    teacher.sessionHash = session.hash;
    teacher.sessionExpiresAt = getSessionExpiry();

    await teacher.save();

    res.json({
      token: session.token,
      teacher: {
        id: teacher._id,
        name: teacher.name
      }
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      message: "Login failed"
    });
  }
});

// ======================================================
// AUTH MIDDLEWARE
// ======================================================

async function requireTeacher(req, res, next) {
  try {
    const token = String(
      req.headers["x-teacher-token"] || ""
    ).trim();

    if (!token) {
      return res.status(401).json({
        message: "Authentication required"
      });
    }

    const teachers = await Teacher.find({
      sessionHash: {
        $ne: ""
      }
    });

    let matchedTeacher = null;

    for (const teacher of teachers) {
      if (
        !teacher.sessionExpiresAt ||
        teacher.sessionExpiresAt <= new Date()
      ) {
        continue;
      }

      const hash = hashValue(
        token,
        teacher.sessionSalt
      );

      if (hash === teacher.sessionHash) {
        matchedTeacher = teacher;
        break;
      }
    }

    if (!matchedTeacher) {
      return res.status(401).json({
        message: "Session expired or invalid"
      });
    }

    req.teacher = matchedTeacher;

    next();
  } catch (error) {
    console.error("AUTH ERROR:", error);

    res.status(401).json({
      message: "Authentication failed"
    });
  }
}

// ======================================================
// CURRENT TEACHER
// ======================================================

app.get(
  "/api/auth/me",
  requireTeacher,
  async (req, res) => {
    res.json({
      teacher: {
        id: req.teacher._id,
        name: req.teacher.name
      }
    });
  }
);

// ======================================================
// CHANGE TEACHER NAME
// ======================================================

app.put(
  "/api/teacher/name",
  requireTeacher,
  async (req, res) => {
    try {
      const newName = String(
        req.body.newTeacherName || ""
      ).trim();

      if (!newName) {
        return res.status(400).json({
          message: "Teacher name is required"
        });
      }

      if (newName === req.teacher.name) {
        return res.json({
          teacher: {
            id: req.teacher._id,
            name: req.teacher.name
          }
        });
      }

      const existing = await Teacher.findOne({
        name: newName,
        _id: {
          $ne: req.teacher._id
        }
      });

      if (existing) {
        return res.status(409).json({
          message: "That teacher name is already in use"
        });
      }

      const oldName = req.teacher.name;

      req.teacher.name = newName;

      await req.teacher.save();

      await Lab.updateMany(
        {
          teacherId: req.teacher._id
        },
        {
          $set: {
            legacyTeacherName: newName
          }
        }
      );

      // Also update old legacy records belonging to this teacher.
      await Lab.updateMany(
        {
          teacherId: null,
          legacyTeacherName: oldName
        },
        {
          $set: {
            teacherId: req.teacher._id,
            legacyTeacherName: newName
          }
        }
      );

      res.json({
        teacher: {
          id: req.teacher._id,
          name: req.teacher.name
        }
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to update teacher name"
      });
    }
  }
);

// ======================================================
// LABS
// ======================================================

app.get(
  "/api/labs",
  requireTeacher,
  async (req, res) => {
    try {
      const labs = await Lab.find({
        teacherId: req.teacher._id
      }).sort({
        createdAt: -1
      });

      res.json(labs);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to load labs"
      });
    }
  }
);

app.post(
  "/api/labs",
  requireTeacher,
  async (req, res) => {
    try {
      const name = String(
        req.body.name || ""
      ).trim();

      const subject = String(
        req.body.subject || ""
      ).trim();

      if (!name) {
        return res.status(400).json({
          message: "Lab name is required"
        });
      }

      const lab = await Lab.create({
        teacherId: req.teacher._id,
        legacyTeacherName: req.teacher.name,
        name,
        subject,
        batches: []
      });

      res.status(201).json(lab);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to create lab"
      });
    }
  }
);

app.put(
  "/api/labs/:labId",
  requireTeacher,
  async (req, res) => {
    try {
      const name = String(
        req.body.name || ""
      ).trim();

      const subject = String(
        req.body.subject || ""
      ).trim();

      if (!name) {
        return res.status(400).json({
          message: "Lab name is required"
        });
      }

      const lab = await Lab.findOneAndUpdate(
        {
          _id: req.params.labId,
          teacherId: req.teacher._id
        },
        {
          name,
          subject
        },
        {
          new: true,
          runValidators: true
        }
      );

      if (!lab) {
        return res.status(404).json({
          message: "Lab not found"
        });
      }

      res.json(lab);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to update lab"
      });
    }
  }
);

app.delete(
  "/api/labs/:labId",
  requireTeacher,
  async (req, res) => {
    try {
      const lab = await Lab.findOneAndDelete({
        _id: req.params.labId,
        teacherId: req.teacher._id
      });

      if (!lab) {
        return res.status(404).json({
          message: "Lab not found"
        });
      }

      res.json({
        message: "Lab deleted"
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to delete lab"
      });
    }
  }
);

// ======================================================
// BATCHES
// ======================================================

app.post(
  "/api/labs/:labId/batches",
  requireTeacher,
  async (req, res) => {
    try {
      const name = String(
        req.body.name || ""
      ).trim();

      if (!name) {
        return res.status(400).json({
          message: "Batch name is required"
        });
      }

      const lab = await Lab.findOne({
        _id: req.params.labId,
        teacherId: req.teacher._id
      });

      if (!lab) {
        return res.status(404).json({
          message: "Lab not found"
        });
      }

      const batch = defaultBatch(name);

      lab.batches.push(batch);

      await lab.save();

      res.status(201).json(batch);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to create batch"
      });
    }
  }
);

app.delete(
  "/api/labs/:labId/batches/:batchId",
  requireTeacher,
  async (req, res) => {
    try {
      const lab = await Lab.findOne({
        _id: req.params.labId,
        teacherId: req.teacher._id
      });

      if (!lab) {
        return res.status(404).json({
          message: "Lab not found"
        });
      }

      const index = lab.batches.findIndex(
        (batch) =>
          batch.id === req.params.batchId
      );

      if (index === -1) {
        return res.status(404).json({
          message: "Batch not found"
        });
      }

      lab.batches.splice(index, 1);

      await lab.save();

      res.json({
        message: "Batch deleted"
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to delete batch"
      });
    }
  }
);

// ======================================================
// SAVE BATCH
// ======================================================

app.put(
  "/api/labs/:labId/batches/:batchId",
  requireTeacher,
  async (req, res) => {
    try {
      const lab = await Lab.findOne({
        _id: req.params.labId,
        teacherId: req.teacher._id
      });

      if (!lab) {
        return res.status(404).json({
          message: "Lab not found"
        });
      }

      const index = lab.batches.findIndex(
        (batch) =>
          batch.id === req.params.batchId
      );

      if (index === -1) {
        return res.status(404).json({
          message: "Batch not found"
        });
      }

      const incoming = req.body;

      const columns = Array.isArray(
        incoming.columns
      )
        ? incoming.columns
        : [];

      const students = Array.isArray(
        incoming.students
      )
        ? incoming.students
        : [];

      lab.batches[index] = {
        id: req.params.batchId,

        name:
          String(incoming.name || "").trim() ||
          "Unnamed Batch",

        columns,

        students
      };

      await lab.save();

      res.json(lab.batches[index]);
    } catch (error) {
      console.error("SAVE BATCH ERROR:", error);

      res.status(500).json({
        message: "Failed to save batch"
      });
    }
  }
);

// ======================================================
// LABBOT
// ======================================================

function normalizeQuestion(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[?!.,'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findBatchMatches(question, labs) {
  const result = [];

  for (const lab of labs) {
    for (const batch of lab.batches) {
      const batchName = normalizeQuestion(
        batch.name
      );

      if (
        batchName &&
        question.includes(batchName)
      ) {
        result.push({
          lab,
          batch
        });
      }
    }
  }

  return result;
}

function findLabMatches(question, labs) {
  return labs.filter((lab) => {
    const name = normalizeQuestion(lab.name);

    const subject = normalizeQuestion(
      lab.subject
    );

    return (
      (name && question.includes(name)) ||
      (subject && question.includes(subject))
    );
  });
}

function getTargetBatches(question, labs) {
  const batchMatches = findBatchMatches(
    question,
    labs
  );

  if (batchMatches.length) {
    return batchMatches;
  }

  const labMatches = findLabMatches(
    question,
    labs
  );

  if (labMatches.length) {
    return labMatches.flatMap((lab) =>
      lab.batches.map((batch) => ({
        lab,
        batch
      }))
    );
  }

  return labs.flatMap((lab) =>
    lab.batches.map((batch) => ({
      lab,
      batch
    }))
  );
}

function findColumn(batch, keywords, type) {
  return batch.columns.find((column) => {
    const label = normalizeQuestion(
      column.label
    );

    const matches = keywords.some((word) =>
      label.includes(word)
    );

    if (!matches) {
      return false;
    }

    if (type && column.type !== type) {
      return false;
    }

    return true;
  });
}

function isSubmitted(value) {
  return normalizeQuestion(value) ===
    "submitted";
}

function getStudentTotal(student, batch) {
  return batch.columns
    .filter(
      (column) =>
        column.type === "number"
    )
    .reduce((total, column) => {
      const value = Number(
        student.values?.[column.id]
      );

      return (
        total +
        (Number.isFinite(value)
          ? value
          : 0)
      );
    }, 0);
}

async function answerLabBot(
  question,
  teacherId
) {
  const labs = await Lab.find({
    teacherId
  }).sort({
    createdAt: -1
  });

  if (!labs.length) {
    return "There is no lab data available yet.";
  }

  const q = normalizeQuestion(question);

  if (!q) {
    return "Please ask me something about your labs, batches, students, submissions or marks.";
  }

  const targetBatches = getTargetBatches(
    q,
    labs
  );

  if (!targetBatches.length) {
    return "I could not find a matching batch or lab.";
  }

  const experimentColumnWords = [
    "experiment",
    "experiments",
    "experiment file",
    "file",
    "exp"
  ];

  const assignmentColumnWords = [
    "assignment",
    "assignments"
  ];

  const experimentColumn =
    targetBatches[0]
      ? findColumn(
          targetBatches[0].batch,
          experimentColumnWords,
          "status"
        )
      : null;

  const assignmentColumn =
    targetBatches[0]
      ? findColumn(
          targetBatches[0].batch,
          assignmentColumnWords,
          "status"
        )
      : null;

  const asksPending =
    q.includes("pending") ||
    q.includes("not submitted") ||
    q.includes("remaining") ||
    q.includes("who has not");

  const asksSubmitted =
    q.includes("submitted") ||
    q.includes("completed") ||
    q.includes("complete");

  const asksExperiment =
    q.includes("experiment") ||
    q.includes("experiments") ||
    q.includes("experiment file") ||
    q.includes("exp");

  const asksAssignment =
    q.includes("assignment") ||
    q.includes("assignments");

  // ----------------------------------------------------
  // COUNT STUDENTS
  // ----------------------------------------------------

  if (
    q.includes("how many") &&
    q.includes("student")
  ) {
    const count = targetBatches.reduce(
      (total, item) =>
        total + item.batch.students.length,
      0
    );

    return `There are ${count} students in the selected batch${targetBatches.length > 1 ? "es" : ""}.`;
  }

  // ----------------------------------------------------
  // TOTAL MARKS FOR A STUDENT
  // ----------------------------------------------------

  if (
    q.includes("total") &&
    (q.includes("mark") ||
      q.includes("score"))
  ) {
    for (const item of targetBatches) {
      for (const student of item.batch.students) {
        const studentName =
          normalizeQuestion(student.name);

        if (
          studentName &&
          q.includes(studentName)
        ) {
          return `${student.name}'s total is ${getStudentTotal(
            student,
            item.batch
          )} marks.`;
        }
      }
    }
  }

  // ----------------------------------------------------
  // PENDING / SUBMITTED EXPERIMENTS
  // ----------------------------------------------------

  if (
    asksExperiment &&
    (asksPending || asksSubmitted)
  ) {
    const names = [];

    for (const item of targetBatches) {
      const column = findColumn(
        item.batch,
        experimentColumnWords,
        "status"
      );

      if (!column) {
        continue;
      }

      for (const student of item.batch.students) {
        const submitted = isSubmitted(
          student.values?.[column.id]
        );

        if (
          (asksPending && !submitted) ||
          (asksSubmitted && submitted)
        ) {
          names.push(
            `${student.name} (${item.batch.name})`
          );
        }
      }
    }

    if (!names.length) {
      return asksPending
        ? "No pending experiment files found."
        : "No submitted experiment files found.";
    }

    return asksPending
      ? `Pending experiment files: ${names.join(", ")}.`
      : `Students who submitted the experiment file: ${names.join(", ")}.`;
  }

  // ----------------------------------------------------
  // PENDING / SUBMITTED ASSIGNMENTS
  // ----------------------------------------------------

  if (
    asksAssignment &&
    (asksPending || asksSubmitted)
  ) {
    const names = [];

    for (const item of targetBatches) {
      const column = findColumn(
        item.batch,
        assignmentColumnWords,
        "status"
      );

      if (!column) {
        continue;
      }

      for (const student of item.batch.students) {
        const submitted = isSubmitted(
          student.values?.[column.id]
        );

        if (
          (asksPending && !submitted) ||
          (asksSubmitted && submitted)
        ) {
          names.push(
            `${student.name} (${item.batch.name})`
          );
        }
      }
    }

    if (!names.length) {
      return asksPending
        ? "No pending assignments found."
        : "No submitted assignments found.";
    }

    return asksPending
      ? `Pending assignments: ${names.join(", ")}.`
      : `Students who submitted the assignment: ${names.join(", ")}.`;
  }

  // ----------------------------------------------------
  // MARKS BELOW A NUMBER
  // ----------------------------------------------------

  const belowMatch = q.match(
    /(?:below|less than|under)\s+(\d+)/
  );

  if (
    belowMatch &&
    q.includes("mark")
  ) {
    const limit = Number(
      belowMatch[1]
    );

    const results = [];

    for (const item of targetBatches) {
      for (const column of item.batch.columns) {
        if (
          column.type !== "number" ||
          !normalizeQuestion(
            column.label
          ).includes("mark")
        ) {
          continue;
        }

        for (const student of item.batch.students) {
          const value = Number(
            student.values?.[column.id]
          );

          if (
            Number.isFinite(value) &&
            value < limit
          ) {
            results.push(
              `${student.name} (${value})`
            );
          }
        }
      }
    }

    if (!results.length) {
      return `No students found with marks below ${limit}.`;
    }

    return `Students with marks below ${limit}: ${results.join(", ")}.`;
  }

  // ----------------------------------------------------
  // LIST STUDENTS
  // ----------------------------------------------------

  if (
    q.includes("show") &&
    q.includes("student")
  ) {
    const students = targetBatches.flatMap(
      (item) =>
        item.batch.students.map(
          (student) =>
            `${student.name} (${item.batch.name})`
        )
    );

    if (!students.length) {
      return "There are no students in the selected batch.";
    }

    return `Students: ${students.join(", ")}.`;
  }

  return "I can answer questions about your labs, batches, students, experiment files, assignments and marks. Try: “I2 pending experiment files” or “How many students are in I2?”";
}

app.post(
  "/api/chat",
  requireTeacher,
  async (req, res) => {
    try {
      const question = String(
        req.body.question || ""
      ).trim();

      if (!question) {
        return res.status(400).json({
          message: "Question is required"
        });
      }

      const answer = await answerLabBot(
        question,
        req.teacher._id
      );

      res.json({
        answer
      });
    } catch (error) {
      console.error("CHAT ERROR:", error);

      res.status(500).json({
        message: "Failed to answer question"
      });
    }
  }
);

// ======================================================
// DATABASE
// ======================================================

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error(
        "MONGODB_URI is missing in backend/.env"
      );
    }

    await mongoose.connect(
      process.env.MONGODB_URI,
      {
        dbName: "collegeDB"
      }
    );

    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(
        `Backend running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error.message
    );

    process.exit(1);
  }
}

startServer();