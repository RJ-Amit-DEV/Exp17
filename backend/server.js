require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const crypto = require("crypto");

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

// ======================================================
// MONGODB SCHEMAS
// ======================================================

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
    },

    builtIn: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
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
  { _id: false }
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
  { _id: false }
);

const labSchema = new mongoose.Schema(
  {
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
  { timestamps: true }
);

const Lab = mongoose.model("Lab", labSchema);

// ======================================================
// HELPERS
// ======================================================

const makeId = () => crypto.randomUUID();

const defaultColumns = () => [
  {
    id: makeId(),
    label: "Experiments File",
    type: "status",
    maxMarks: 0,
    builtIn: true
  },
  {
    id: makeId(),
    label: "Experiment Marks",
    type: "number",
    maxMarks: 20,
    builtIn: true
  },
  {
    id: makeId(),
    label: "Assignments",
    type: "status",
    maxMarks: 0,
    builtIn: true
  },
  {
    id: makeId(),
    label: "Assignment Marks",
    type: "number",
    maxMarks: 10,
    builtIn: true
  }
];

const defaultBatch = (name) => ({
  id: makeId(),
  name,
  columns: defaultColumns(),
  students: []
});

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[?!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------
// Fix old column data
// ------------------------------------------------------

function normalizeColumns(columns) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return defaultColumns();
  }

  return columns.map((column) => {
    const label = normalize(column.label);

    if (label === "experiments file") {
      return {
        ...column,
        label: "Experiments File",
        type: "status",
        maxMarks: 0,
        builtIn: true
      };
    }

    if (
      label === "experiment marks" ||
      label === "experiment mark"
    ) {
      return {
        ...column,
        label: "Experiment Marks",
        type: "number",
        maxMarks: 20,
        builtIn: true
      };
    }

    if (label === "assignments" || label === "assignment") {
      return {
        ...column,
        label: "Assignments",
        type: "status",
        maxMarks: 0,
        builtIn: true
      };
    }

    if (
      label === "assignment marks" ||
      label === "assignment mark"
    ) {
      return {
        ...column,
        label: "Assignment Marks",
        type: "number",
        maxMarks: 10,
        builtIn: true
      };
    }

    return {
      ...column,
      builtIn: Boolean(column.builtIn)
    };
  });
}

// ======================================================
// BASIC ROUTE
// ======================================================

app.get("/", (req, res) => {
  res.json({
    message: "Lab Management API is running"
  });
});

// ======================================================
// LAB ROUTES
// ======================================================

// Get all labs
app.get("/api/labs", async (req, res) => {
  try {
    const labs = await Lab.find().sort({
      createdAt: -1
    });

    const normalizedLabs = labs.map((lab) => {
      const plainLab = lab.toObject();

      plainLab.batches = plainLab.batches.map(
        (batch) => ({
          ...batch,
          columns: normalizeColumns(batch.columns)
        })
      );

      return plainLab;
    });

    res.json(normalizedLabs);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to load labs"
    });
  }
});

// Get one lab
app.get("/api/labs/:labId", async (req, res) => {
  try {
    const lab = await Lab.findById(
      req.params.labId
    );

    if (!lab) {
      return res.status(404).json({
        message: "Lab not found"
      });
    }

    const plainLab = lab.toObject();

    plainLab.batches = plainLab.batches.map(
      (batch) => ({
        ...batch,
        columns: normalizeColumns(batch.columns)
      })
    );

    res.json(plainLab);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to load lab"
    });
  }
});

// Create lab
app.post("/api/labs", async (req, res) => {
  try {
    const { name, subject } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Lab name is required"
      });
    }

    const lab = await Lab.create({
      name: name.trim(),
      subject: subject?.trim() || "",
      batches: []
    });

    res.status(201).json(lab);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create lab"
    });
  }
});

// Edit lab
app.put("/api/labs/:labId", async (req, res) => {
  try {
    const { name, subject } = req.body;

    const lab = await Lab.findByIdAndUpdate(
      req.params.labId,
      {
        name: name?.trim(),
        subject: subject?.trim() || ""
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
});

// Delete lab
app.delete("/api/labs/:labId", async (req, res) => {
  try {
    const lab = await Lab.findByIdAndDelete(
      req.params.labId
    );

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
});

// ======================================================
// BATCH ROUTES
// ======================================================

// Create batch
app.post(
  "/api/labs/:labId/batches",
  async (req, res) => {
    try {
      const { name } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({
          message: "Batch name is required"
        });
      }

      const lab = await Lab.findById(
        req.params.labId
      );

      if (!lab) {
        return res.status(404).json({
          message: "Lab not found"
        });
      }

      const batch = defaultBatch(
        name.trim()
      );

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

// Delete batch
app.delete(
  "/api/labs/:labId/batches/:batchId",
  async (req, res) => {
    try {
      const lab = await Lab.findById(
        req.params.labId
      );

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
// SAVE ENTIRE BATCH
// ======================================================

app.put(
  "/api/labs/:labId/batches/:batchId",
  async (req, res) => {
    try {
      const lab = await Lab.findById(
        req.params.labId
      );

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

      const columns = normalizeColumns(
        incoming.columns
      );

      const students = Array.isArray(
        incoming.students
      )
        ? incoming.students
        : [];

      // Validate marks
      const numberColumns =
        columns.filter(
          (column) =>
            column.type === "number"
        );

      for (const student of students) {
        for (const column of numberColumns) {
          const value = Number(
            student.values?.[column.id]
          );

          if (!Number.isFinite(value)) {
            continue;
          }

          if (value < 0) {
            return res.status(400).json({
              message: `${column.label} cannot be negative`
            });
          }

          if (
            Number(column.maxMarks) > 0 &&
            value > Number(column.maxMarks)
          ) {
            return res.status(400).json({
              message: `${column.label} cannot be greater than ${column.maxMarks}`
            });
          }
        }
      }

      lab.batches[index] = {
        id: req.params.batchId,

        name:
          incoming.name ||
          "Unnamed Batch",

        columns,

        students
      };

      await lab.save();

      res.json(lab.batches[index]);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message: "Failed to save batch"
      });
    }
  }
);

// ======================================================
// LABBOT HELPERS
// ======================================================

function findMatchingLabs(
  question,
  labs
) {
  return labs.filter((lab) => {
    const labName = normalize(
      lab.name
    );

    return (
      labName &&
      question.includes(labName)
    );
  });
}

function findMatchingBatches(
  question,
  labs
) {
  const results = [];

  for (const lab of labs) {
    for (const batch of lab.batches) {
      const batchName = normalize(
        batch.name
      );

      if (
        batchName &&
        question.includes(batchName)
      ) {
        results.push({
          lab,
          batch
        });

        continue;
      }

      const cleanedBatch =
        batchName.replace(/\s+/g, "");

      const match =
        cleanedBatch.match(
          /^i[-]?(\d+)$/
        );

      if (match) {
        const number = match[1];

        const patterns = [
          `i${number}`,
          `i-${number}`,
          `batch ${number}`,
          `batch i${number}`,
          `batch i-${number}`
        ];

        if (
          patterns.some((pattern) =>
            question.includes(pattern)
          )
        ) {
          results.push({
            lab,
            batch
          });
        }
      }
    }
  }

  return results;
}

function findColumn(
  batch,
  words,
  type = null
) {
  return batch.columns.find(
    (column) => {
      const label = normalize(
        column.label
      );

      const matches = words.some(
        (word) =>
          label.includes(word)
      );

      if (!matches) {
        return false;
      }

      if (
        type &&
        column.type !== type
      ) {
        return false;
      }

      return true;
    }
  );
}

// ======================================================
// STATUS
// ======================================================

function isSubmitted(value) {
  const text = normalize(value);

  return [
    "submitted",
    "done",
    "completed",
    "complete",
    "finished",
    "yes",
    "true"
  ].includes(text);
}

function isPendingValue(value) {
  return !isSubmitted(value);
}

// ======================================================
// TOTAL
// ======================================================

function getTotal(
  student,
  batch
) {
  return batch.columns
    .filter(
      (column) =>
        column.type === "number"
    )
    .reduce(
      (total, column) => {
        const value = Number(
          student.values?.[
            column.id
          ]
        );

        return (
          total +
          (Number.isFinite(value)
            ? value
            : 0)
        );
      },
      0
    );
}

// ======================================================
// LABBOT ENGINE
// ======================================================

async function answerLabBot(
  question
) {
  const labs = await Lab.find();

  if (!labs.length) {
    return "There is no lab data available yet.";
  }

  const q = normalize(question);

  // ----------------------------------------------------
  // Find batch
  // ----------------------------------------------------

  const matchedBatches =
    findMatchingBatches(
      q,
      labs
    );

  let targetBatches =
    matchedBatches;

  // ----------------------------------------------------
  // Find lab
  // ----------------------------------------------------

  if (!targetBatches.length) {
    const matchedLabs =
      findMatchingLabs(
        q,
        labs
      );

    if (matchedLabs.length) {
      targetBatches =
        matchedLabs.flatMap(
          (lab) =>
            lab.batches.map(
              (batch) => ({
                lab,
                batch
              })
            )
        );
    }
  }

  // ----------------------------------------------------
  // Otherwise search all
  // ----------------------------------------------------

  if (!targetBatches.length) {
    targetBatches =
      labs.flatMap(
        (lab) =>
          lab.batches.map(
            (batch) => ({
              lab,
              batch
            })
          )
      );
  }

  // ====================================================
  // QUESTION TYPE
  // ====================================================

  const isExperiment =
    q.includes("experiment") ||
    q.includes("experiments") ||
    q.includes("experiment file") ||
    q.includes("experiments file") ||
    q.includes("exp file") ||
    q.includes("exp");

  const isAssignment =
    q.includes("assignment") ||
    q.includes("assignments") ||
    q.includes("assignment file") ||
    q.includes("assign");

  const isDoneWord =
    q.includes("done") ||
    q.includes("completed") ||
    q.includes("complete") ||
    q.includes("finished");

  const isPending =
    q.includes("pending") ||
    q.includes("not submitted") ||
    q.includes("haven't submitted") ||
    q.includes("have not submitted") ||
    q.includes("missing") ||
    q.includes("incomplete");

  const isSubmittedQuestion =
    q.includes("submitted") &&
    !isPending;

  // ====================================================
  // TOTAL MARKS
  // ====================================================

  const wantsTotal =
    q.includes("total") &&
    (
      q.includes("marks") ||
      q.includes("score") ||
      q.includes("student")
    );

  if (wantsTotal) {
    for (
      const { batch } of targetBatches
    ) {
      const student =
        batch.students.find(
          (student) =>
            student.name &&
            q.includes(
              normalize(
                student.name
              )
            )
        );

      if (student) {
        return `${student.name}'s total is ${getTotal(
          student,
          batch
        )} marks.`;
      }
    }
  }

  // ====================================================
  // MARKS BELOW / ABOVE
  // ====================================================

  const belowMatch =
    q.match(
      /(?:below|less than|under)\s+(\d+)/
    );

  const aboveMatch =
    q.match(
      /(?:above|greater than|more than|over)\s+(\d+)/
    );

  if (
    belowMatch ||
    aboveMatch
  ) {
    const limit = Number(
      (belowMatch ||
        aboveMatch)[1]
    );

    const isBelow =
      Boolean(belowMatch);

    const targetColumnWords =
      isAssignment
        ? [
            "assignment",
            "assignments"
          ]
        : [
            "experiment",
            "experiments",
            "exp"
          ];

    const results = [];

    for (
      const { batch } of targetBatches
    ) {
      const column =
        findColumn(
          batch,
          targetColumnWords,
          "number"
        );

      if (!column) {
        continue;
      }

      for (
        const student of batch.students
      ) {
        const value = Number(
          student.values?.[
            column.id
          ]
        );

        if (
          !Number.isFinite(value)
        ) {
          continue;
        }

        if (
          (isBelow &&
            value < limit) ||
          (!isBelow &&
            value > limit)
        ) {
          results.push(
            `${student.rollNo || "-"} - ${
              student.name || "Unnamed"
            } (${value})`
          );
        }
      }
    }

    if (!results.length) {
      return "No matching students were found.";
    }

    return results.join("\n");
  }

  // ====================================================
  // EXPERIMENT / ASSIGNMENT STATUS
  // ====================================================

  if (
    isExperiment ||
    isAssignment ||
    isDoneWord ||
    isPending
  ) {
    const useAssignment =
      isAssignment &&
      !isExperiment;

    const words = useAssignment
      ? [
          "assignment",
          "assignments",
          "assign"
        ]
      : [
          "experiment",
          "experiments",
          "exp",
          "file"
        ];

    const results = [];

    for (
      const { batch } of targetBatches
    ) {
      const column =
        findColumn(
          batch,
          words,
          "status"
        );

      if (!column) {
        continue;
      }

      for (
        const student of batch.students
      ) {
        const value =
          student.values?.[
            column.id
          ];

        if (
          isPending &&
          isPendingValue(value)
        ) {
          results.push({
            batch: batch.name,
            student
          });
        }

        if (
          (
            isSubmittedQuestion ||
            isDoneWord
          ) &&
          isSubmitted(value)
        ) {
          results.push({
            batch: batch.name,
            student
          });
        }
      }
    }

    const typeName =
      useAssignment
        ? "assignment"
        : "experiment file";

    if (!results.length) {
      return `No matching ${typeName} records were found.`;
    }

    if (
      q.includes("how many") ||
      q.includes("count") ||
      q.includes("number of")
    ) {
      if (isPending) {
        return `${results.length} student(s) have not submitted the ${typeName}.`;
      }

      return `${results.length} student(s) have submitted the ${typeName}.`;
    }

    const names =
      results.map(
        (item) =>
          `${item.student.rollNo || "-"} - ${
            item.student.name || "Unnamed"
          }`
      );

    if (isPending) {
      return `Pending ${typeName}:\n${names.join(
        "\n"
      )}`;
    }

    return `Submitted ${typeName}:\n${names.join(
      "\n"
    )}`;
  }

  // ====================================================
  // STUDENT COUNT
  // ====================================================

  if (
    q.includes("how many students") ||
    q.includes("number of students") ||
    q.includes("student count") ||
    q.includes("how many student")
  ) {
    const count =
      targetBatches.reduce(
        (total, item) =>
          total +
          item.batch.students.length,
        0
      );

    return `There are ${count} student(s) in the selected batch/lab.`;
  }

  // ====================================================
  // SHOW / LIST STUDENTS
  // ====================================================

  if (
    q.includes("show students") ||
    q.includes("list students") ||
    q.includes("students in") ||
    q.includes("who are the students") ||
    q.includes("show i1 students") ||
    q.includes("show i2 students") ||
    q.includes("show i3 students") ||
    q.includes("list i1 students") ||
    q.includes("list i2 students") ||
    q.includes("list i3 students") ||
    q.endsWith(" students")
  ) {
    const students =
      targetBatches.flatMap(
        ({ batch }) =>
          batch.students.map(
            (student) =>
              `${student.rollNo || "-"} - ${
                student.name || "Unnamed"
              }`
          )
      );

    if (!students.length) {
      return "There are no students in the selected batch.";
    }

    return students.join("\n");
  }

  // ====================================================
  // OUTSIDE SCOPE
  // ====================================================

  return "I can only answer questions about your labs, batches, students, experiment files, assignments and marks.";
}

// ======================================================
// CHAT API
// ======================================================

app.post(
  "/api/chat",
  async (req, res) => {
    try {
      const { question } =
        req.body;

      if (
        !question ||
        !question.trim()
      ) {
        return res.status(400).json({
          message:
            "Question is required"
        });
      }

      const answer =
        await answerLabBot(
          question
        );

      res.json({
        answer
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        message:
          "LabBot could not process the question"
      });
    }
  }
);

// ======================================================
// DATABASE + SERVER
// ======================================================

mongoose
  .connect(
    process.env.MONGODB_URI,
    {
      dbName: "collegeDB"
    }
  )
  .then(() => {
    console.log(
      "MongoDB connected"
    );

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `Backend running on port ${PORT}`
        );
      }
    );
  })
  .catch((error) => {
    console.error(
      "MongoDB connection failed:",
      error
    );

    process.exit(1);
  });