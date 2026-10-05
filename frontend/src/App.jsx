import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API =
  import.meta.env.VITE_API_URL ||
  "https://exp17.onrender.com/api";

const makeId = () => crypto.randomUUID();

const helpExamples = [
  "Show I2 students",
  "In I2 which student completed the experiment file?",
  "I2 pending experiment files",
  "Who submitted assignment in I3?",
  "How many students are in I2?",
  "I1 students with experiment marks below 5",
  "Who has pending assignments in I1?",
  "What is Amit's total marks?"
];

function normalizeColumns(columns) {
  if (!Array.isArray(columns)) {
    return [];
  }

  return columns.map((column) => {
    const label = String(column.label || "")
      .toLowerCase()
      .trim();

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

    if (
      label === "assignments" ||
      label === "assignment"
    ) {
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

function normalizeLabs(data) {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map((lab) => ({
    ...lab,
    batches: Array.isArray(lab.batches)
      ? lab.batches.map((batch) => ({
          ...batch,
          columns: normalizeColumns(batch.columns),
          students: Array.isArray(batch.students)
            ? batch.students
            : []
        }))
      : []
  }));
}

function App() {
  const [labs, setLabs] = useState([]);
  const [selectedLabId, setSelectedLabId] =
    useState("");
  const [activeBatchId, setActiveBatchId] =
    useState("");

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [showLabForm, setShowLabForm] = useState(false);
  const [showBatchForm, setShowBatchForm] =
    useState(false);
  const [showColumnForm, setShowColumnForm] =
    useState(false);

  const [showBotHelp, setShowBotHelp] = useState(false);

  const [labName, setLabName] = useState("");
  const [subjectName, setSubjectName] =
    useState("");
  const [batchName, setBatchName] = useState("");

  const [columnName, setColumnName] = useState("");
  const [columnType, setColumnType] =
    useState("status");
  const [columnMarks, setColumnMarks] =
    useState("");

  const [chatOpen, setChatOpen] = useState(false);
  const [question, setQuestion] = useState("");

  const [chatMessages, setChatMessages] =
    useState([
      {
        role: "bot",
        text:
          "Hi! I'm LabBot. Ask me about students, pending work, assignments, batches or marks."
      }
    ]);

  const [chatLoading, setChatLoading] =
    useState(false);

  // =====================================================
  // TEACHER NAME
  // =====================================================

  const [teacherName, setTeacherName] = useState(
    localStorage.getItem("teacherName") || ""
  );

  const [showTeacherForm, setShowTeacherForm] =
    useState(
      !localStorage.getItem("teacherName")
    );

  const saveTeacherName = (event) => {
    event.preventDefault();

    const name = teacherName.trim();

    if (!name) {
      return;
    }

    localStorage.setItem(
      "teacherName",
      name
    );

    setTeacherName(name);
    setShowTeacherForm(false);
  };

  // =====================================================
  // LOAD LABS
  // =====================================================

  const loadLabs = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${API}/labs`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load labs"
        );
      }

      const data = await response.json();

      const normalized = normalizeLabs(data);

      setLabs(normalized);

      if (
        normalized.length &&
        !selectedLabId
      ) {
        setSelectedLabId(
          normalized[0]._id
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLabs();
  }, []);

  // =====================================================
  // CURRENT LAB / BATCH
  // =====================================================

  const selectedLab = labs.find(
    (lab) => lab._id === selectedLabId
  );

  const activeBatch =
    selectedLab?.batches?.find(
      (batch) => batch.id === activeBatchId
    );

  useEffect(() => {
    if (
      selectedLab?.batches?.length &&
      !selectedLab.batches.some(
        (batch) => batch.id === activeBatchId
      )
    ) {
      setActiveBatchId(
        selectedLab.batches[0].id
      );
    }

    if (!selectedLab?.batches?.length) {
      setActiveBatchId("");
    }
  }, [selectedLab, activeBatchId]);

  // =====================================================
  // SEARCH
  // =====================================================

  const visibleStudents = useMemo(() => {
    if (!activeBatch) {
      return [];
    }

    const query = search.toLowerCase().trim();

    if (!query) {
      return activeBatch.students;
    }

    return activeBatch.students.filter(
      (student) =>
        `${student.name || ""} ${
          student.rollNo || ""
        }`
          .toLowerCase()
          .includes(query)
    );
  }, [activeBatch, search]);

  // =====================================================
  // CREATE LAB
  // =====================================================

  const createLab = async (event) => {
    event.preventDefault();

    if (!labName.trim()) {
      return;
    }

    try {
      const response = await fetch(
        `${API}/labs`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: labName.trim(),
            subject: subjectName.trim()
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to create lab"
        );
      }

      const newLab = await response.json();

      setLabs((current) => [
        newLab,
        ...current
      ]);

      setSelectedLabId(newLab._id);
      setActiveBatchId("");

      setLabName("");
      setSubjectName("");
      setShowLabForm(false);
    } catch (error) {
      console.error(error);
      alert("Could not create lab.");
    }
  };

  // =====================================================
  // DELETE LAB
  // =====================================================

  const deleteLab = async () => {
    if (!selectedLab) {
      return;
    }

    const ok = window.confirm(
      `Delete "${selectedLab.name}" and all its batches?`
    );

    if (!ok) {
      return;
    }

    try {
      const response = await fetch(
        `${API}/labs/${selectedLab._id}`,
        {
          method: "DELETE"
        }
      );

      if (!response.ok) {
        throw new Error(
          "Delete failed"
        );
      }

      const remaining = labs.filter(
        (lab) =>
          lab._id !== selectedLab._id
      );

      setLabs(remaining);

      setSelectedLabId(
        remaining[0]?._id || ""
      );

      setActiveBatchId("");
    } catch (error) {
      console.error(error);
      alert("Could not delete lab.");
    }
  };

  // =====================================================
  // CREATE BATCH
  // =====================================================

  const createBatch = async (event) => {
    event.preventDefault();

    if (
      !selectedLab ||
      !batchName.trim()
    ) {
      return;
    }

    try {
      const response = await fetch(
        `${API}/labs/${selectedLab._id}/batches`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: batchName.trim()
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to create batch"
        );
      }

      const newBatch = await response.json();

      setLabs((current) =>
        current.map((lab) =>
          lab._id === selectedLab._id
            ? {
                ...lab,
                batches: [
                  ...lab.batches,
                  newBatch
                ]
              }
            : lab
        )
      );

      setActiveBatchId(newBatch.id);

      setBatchName("");
      setShowBatchForm(false);
    } catch (error) {
      console.error(error);
      alert("Could not create batch.");
    }
  };

  // =====================================================
  // DELETE BATCH
  // =====================================================

  const deleteBatch = async () => {
    if (
      !selectedLab ||
      !activeBatch
    ) {
      return;
    }

    const ok = window.confirm(
      `Delete batch "${activeBatch.name}"?`
    );

    if (!ok) {
      return;
    }

    try {
      const response = await fetch(
        `${API}/labs/${selectedLab._id}/batches/${activeBatch.id}`,
        {
          method: "DELETE"
        }
      );

      if (!response.ok) {
        throw new Error(
          "Delete failed"
        );
      }

      setLabs((current) =>
        current.map((lab) =>
          lab._id === selectedLab._id
            ? {
                ...lab,
                batches:
                  lab.batches.filter(
                    (batch) =>
                      batch.id !==
                      activeBatch.id
                  )
              }
            : lab
        )
      );

      setActiveBatchId("");
    } catch (error) {
      console.error(error);
      alert("Could not delete batch.");
    }
  };

  // =====================================================
  // UPDATE BATCH
  // =====================================================

  const updateBatch = (changes) => {
    if (
      !selectedLab ||
      !activeBatch
    ) {
      return;
    }

    setSaved(false);
    setSaveError("");

    setLabs((current) =>
      current.map((lab) =>
        lab._id !== selectedLab._id
          ? lab
          : {
              ...lab,
              batches:
                lab.batches.map(
                  (batch) =>
                    batch.id !==
                    activeBatch.id
                      ? batch
                      : {
                          ...batch,
                          ...changes
                        }
                )
            }
      )
    );
  };

  // =====================================================
  // UPDATE STUDENT
  // =====================================================

  const updateStudent = (
    studentId,
    changes
  ) => {
    updateBatch({
      students:
        activeBatch.students.map(
          (student) =>
            student.id === studentId
              ? {
                  ...student,
                  ...changes
                }
              : student
        )
    });
  };

  const updateStudentValue = (
    studentId,
    columnId,
    value
  ) => {
    const student =
      activeBatch.students.find(
        (item) =>
          item.id === studentId
      );

    if (!student) {
      return;
    }

    const column =
      activeBatch.columns.find(
        (item) =>
          item.id === columnId
      );

    if (
      column?.type === "number" &&
      value !== ""
    ) {
      const number = Number(value);

      if (
        Number.isFinite(number) &&
        number < 0
      ) {
        return;
      }

      if (
        Number.isFinite(number) &&
        column.maxMarks > 0 &&
        number > column.maxMarks
      ) {
        return;
      }
    }

    updateStudent(
      studentId,
      {
        values: {
          ...(student.values || {}),
          [columnId]: value
        }
      }
    );
  };

  // =====================================================
  // ADD STUDENT
  // =====================================================

  const addStudent = () => {
    const student = {
      id: makeId(),
      rollNo: "",
      name: "",
      age: "",
      values: {}
    };

    updateBatch({
      students: [
        ...activeBatch.students,
        student
      ]
    });
  };

  // =====================================================
  // DELETE STUDENT
  // =====================================================

  const deleteStudent = (
    studentId
  ) => {
    updateBatch({
      students:
        activeBatch.students.filter(
          (student) =>
            student.id !== studentId
        )
    });
  };

  // =====================================================
  // ADD CUSTOM COLUMN
  // =====================================================

  const addColumn = (event) => {
    event.preventDefault();

    if (!columnName.trim()) {
      return;
    }

    if (
      columnType === "number" &&
      (!columnMarks ||
        Number(columnMarks) <= 0)
    ) {
      alert(
        "Enter a valid maximum mark."
      );

      return;
    }

    const column = {
      id: makeId(),
      label: columnName.trim(),
      type: columnType,
      maxMarks:
        columnType === "number"
          ? Number(columnMarks)
          : 0,
      builtIn: false
    };

    updateBatch({
      columns: [
        ...activeBatch.columns,
        column
      ]
    });

    setColumnName("");
    setColumnType("status");
    setColumnMarks("");
    setShowColumnForm(false);
  };

  // =====================================================
  // DELETE CUSTOM COLUMN
  // =====================================================

  const deleteColumn = (
    columnId
  ) => {
    const column =
      activeBatch.columns.find(
        (item) =>
          item.id === columnId
      );

    if (!column) {
      return;
    }

    if (column.builtIn) {
      alert(
        "Default columns cannot be deleted."
      );

      return;
    }

    const ok = window.confirm(
      `Delete custom column "${column.label}"?`
    );

    if (!ok) {
      return;
    }

    const updatedStudents =
      activeBatch.students.map(
        (student) => {
          const values = {
            ...(student.values || {})
          };

          delete values[columnId];

          return {
            ...student,
            values
          };
        }
      );

    updateBatch({
      columns:
        activeBatch.columns.filter(
          (item) =>
            item.id !== columnId
        ),
      students: updatedStudents
    });
  };

  // =====================================================
  // UPDATE COLUMN
  // =====================================================

  const updateColumn = (
    columnId,
    changes
  ) => {
    updateBatch({
      columns:
        activeBatch.columns.map(
          (column) =>
            column.id === columnId
              ? {
                  ...column,
                  ...changes
                }
              : column
        )
    });
  };

  // =====================================================
  // SAVE BATCH
  // =====================================================

  const saveBatch = async () => {
    if (
      !selectedLab ||
      !activeBatch
    ) {
      return;
    }

    try {
      setSaving(true);
      setSaved(false);
      setSaveError("");

      const response = await fetch(
        `${API}/labs/${selectedLab._id}/batches/${activeBatch.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            ...activeBatch,
            columns:
              normalizeColumns(
                activeBatch.columns
              )
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Save failed"
        );
      }

      const savedBatch = {
        ...data,
        columns:
          normalizeColumns(
            data.columns
          )
      };

      setLabs((current) =>
        current.map((lab) =>
          lab._id !== selectedLab._id
            ? lab
            : {
                ...lab,
                batches:
                  lab.batches.map(
                    (batch) =>
                      batch.id ===
                      savedBatch.id
                        ? savedBatch
                        : batch
                  )
              }
        )
      );

      setSaved(true);
    } catch (error) {
      console.error(error);

      setSaved(false);

      setSaveError(
        error.message ||
          "Could not save batch."
      );
    } finally {
      setSaving(false);
    }
  };

  // =====================================================
  // TOTAL
  // =====================================================

  const getTotal = (student) => {
    if (!activeBatch) {
      return 0;
    }

    return activeBatch.columns
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
  };

  // =====================================================
  // LABBOT
  // =====================================================

  const askBot = async (event) => {
    event.preventDefault();

    if (!question.trim()) {
      return;
    }

    const currentQuestion =
      question.trim();

    setChatMessages((messages) => [
      ...messages,
      {
        role: "user",
        text: currentQuestion
      }
    ]);

    setQuestion("");
    setChatLoading(true);

    try {
      const response = await fetch(
        `${API}/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            question:
              currentQuestion
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Bot request failed"
        );
      }

      setChatMessages((messages) => [
        ...messages,
        {
          role: "bot",
          text:
            data.answer ||
            "I could not find an answer."
        }
      ]);
    } catch (error) {
      console.error(error);

      setChatMessages((messages) => [
        ...messages,
        {
          role: "bot",
          text:
            "Sorry, I could not connect to the server."
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // =====================================================
  // LOADING
  // =====================================================

  if (loading) {
    return (
      <div className="loading-screen">
        Loading Lab Management...
      </div>
    );
  }

  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="app">

      {/* TOP BAR */}

      <header className="topbar">
        <div>
          <h1>
            Lab Management
          </h1>

          {teacherName && (
            <p>
              Teacher:{" "}
              <strong>
                {teacherName}
              </strong>
            </p>
          )}
        </div>

        <button
          className="primary"
          onClick={() =>
            setShowLabForm(true)
          }
        >
          + New Lab
        </button>
      </header>

      <main className="main">

        {/* LABS */}

        <section className="lab-section">
          <div className="section-title">
            <div>
              <h2>
                My Labs
              </h2>

              <span>
                Create and manage
                your subject labs
              </span>
            </div>
          </div>

          {labs.length === 0 ? (
            <div className="empty">
              <h3>
                No labs created
              </h3>

              <p>
                Create your first
                lab to start
                managing batches.
              </p>

              <button
                className="primary"
                onClick={() =>
                  setShowLabForm(true)
                }
              >
                + Create Lab
              </button>
            </div>
          ) : (
            <div className="lab-tabs">
              {labs.map((lab) => (
                <button
                  key={lab._id}
                  className={
                    selectedLabId ===
                    lab._id
                      ? "lab-tab active"
                      : "lab-tab"
                  }
                  onClick={() => {
                    setSelectedLabId(
                      lab._id
                    );
                    setActiveBatchId("");
                    setSearch("");
                    setSaved(false);
                    setSaveError("");
                  }}
                >
                  <strong>
                    {lab.name}
                  </strong>

                  <small>
                    {lab.batches.length}{" "}
                    batch
                    {lab.batches.length !==
                    1
                      ? "es"
                      : ""}
                  </small>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* WORKSPACE */}

        {selectedLab && (
          <section className="workspace">

            <div className="workspace-header">
              <div>
                <h2>
                  {selectedLab.name}
                </h2>

                {selectedLab.subject && (
                  <p>
                    {selectedLab.subject}
                  </p>
                )}
              </div>

              <div className="actions">

                <button
                  className="secondary"
                  onClick={() =>
                    setShowBatchForm(
                      true
                    )
                  }
                >
                  + Add Batch
                </button>

                <button
                  className="danger-outline"
                  onClick={deleteLab}
                >
                  Delete Lab
                </button>

              </div>
            </div>

            {/* BATCH TABS */}

            <div className="batch-tabs">
              {selectedLab.batches.map(
                (batch) => (
                  <button
                    key={batch.id}
                    className={
                      activeBatchId ===
                      batch.id
                        ? "batch-tab active"
                        : "batch-tab"
                    }
                    onClick={() => {
                      setActiveBatchId(
                        batch.id
                      );
                      setSearch("");
                      setSaved(false);
                      setSaveError("");
                    }}
                  >
                    {batch.name}
                  </button>
                )
              )}
            </div>

            {!activeBatch ? (
              <div className="empty">
                <h3>
                  Select or create
                  a batch
                </h3>

                <button
                  className="primary"
                  onClick={() =>
                    setShowBatchForm(
                      true
                    )
                  }
                >
                  + Create Batch
                </button>
              </div>
            ) : (
              <>
                {/* BATCH HEADER */}

                <div className="batch-header">
                  <div>
                    <h2>
                      {activeBatch.name}
                    </h2>

                    <p>
                      {
                        activeBatch
                          .students
                          .length
                      }{" "}
                      students
                    </p>
                  </div>

                  <div className="actions">

                    <button
                      className="secondary"
                      onClick={
                        addStudent
                      }
                    >
                      + Student
                    </button>

                    <button
                      className="secondary"
                      onClick={() =>
                        setShowColumnForm(
                          true
                        )
                      }
                    >
                      + Column
                    </button>

                    <button
                      className="danger-outline"
                      onClick={
                        deleteBatch
                      }
                    >
                      Delete Batch
                    </button>

                  </div>
                </div>

                {/* SEARCH */}

                <div className="table-tools">
                  <input
                    className="search"
                    placeholder="Search by name or roll number..."
                    value={search}
                    onChange={(event) =>
                      setSearch(
                        event.target.value
                      )
                    }
                  />
                </div>

                {/* TABLE */}

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>

                        <th>
                          Roll No
                        </th>

                        <th>
                          Name
                        </th>

                        <th>
                          Age
                        </th>

                        {activeBatch.columns.map(
                          (column) => (
                            <th
                              key={
                                column.id
                              }
                            >
                              <div className="column-head">

                                <input
                                  value={
                                    column.label
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateColumn(
                                      column.id,
                                      {
                                        label:
                                          event
                                            .target
                                            .value
                                      }
                                    )
                                  }
                                />

                                {column.type ===
                                  "number" && (
                                  <small>
                                    /
                                    {
                                      column.maxMarks
                                    }
                                  </small>
                                )}

                                {!column.builtIn && (
                                  <button
                                    type="button"
                                    className="delete-column"
                                    onClick={() =>
                                      deleteColumn(
                                        column.id
                                      )
                                    }
                                    title="Delete custom column"
                                    aria-label="Delete custom column"
                                  >
                                    🗑
                                  </button>
                                )}

                              </div>
                            </th>
                          )
                        )}

                        <th>
                          Total
                        </th>

                        <th>
                          Action
                        </th>

                      </tr>
                    </thead>

                    <tbody>

                      {visibleStudents.length ===
                      0 ? (
                        <tr>
                          <td
                            colSpan={
                              5 +
                              activeBatch
                                .columns
                                .length
                            }
                            className="no-data"
                          >
                            No students
                            found.
                          </td>
                        </tr>
                      ) : (
                        visibleStudents.map(
                          (student) => (
                            <tr
                              key={
                                student.id
                              }
                            >

                              <td>
                                <input
                                  value={
                                    student.rollNo ||
                                    ""
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateStudent(
                                      student.id,
                                      {
                                        rollNo:
                                          event
                                            .target
                                            .value
                                      }
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  value={
                                    student.name ||
                                    ""
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateStudent(
                                      student.id,
                                      {
                                        name:
                                          event
                                            .target
                                            .value
                                      }
                                    )
                                  }
                                />
                              </td>

                              <td>
                                <input
                                  className="age-input"
                                  type="number"
                                  min="1"
                                  value={
                                    student.age ??
                                    ""
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateStudent(
                                      student.id,
                                      {
                                        age:
                                          event
                                            .target
                                            .value ===
                                          ""
                                            ? ""
                                            : Number(
                                                event
                                                  .target
                                                  .value
                                              )
                                      }
                                    )
                                  }
                                />
                              </td>

                              {activeBatch.columns.map(
                                (column) => (
                                  <td
                                    key={
                                      column.id
                                    }
                                  >

                                    {column.type ===
                                    "status" ? (
                                      <select
                                        value={
                                          student
                                            .values?.[
                                            column
                                              .id
                                          ] ||
                                          "Pending"
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateStudentValue(
                                            student.id,
                                            column.id,
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                      >
                                        <option value="Pending">
                                          Pending
                                        </option>

                                        <option value="Submitted">
                                          Submitted
                                        </option>
                                      </select>
                                    ) : (
                                      <input
                                        type={
                                          column.type ===
                                          "number"
                                            ? "number"
                                            : "text"
                                        }
                                        min={
                                          column.type ===
                                          "number"
                                            ? "0"
                                            : undefined
                                        }
                                        max={
                                          column.type ===
                                            "number" &&
                                          column.maxMarks >
                                            0
                                            ? column.maxMarks
                                            : undefined
                                        }
                                        value={
                                          student
                                            .values?.[
                                            column
                                              .id
                                          ] ??
                                          ""
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updateStudentValue(
                                            student.id,
                                            column.id,
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                      />
                                    )}

                                  </td>
                                )
                              )}

                              <td className="total">
                                {getTotal(
                                  student
                                )}
                              </td>

                              <td>
                                <button
                                  className="delete-row"
                                  onClick={() =>
                                    deleteStudent(
                                      student.id
                                    )
                                  }
                                  title="Delete student"
                                >
                                  🗑
                                </button>
                              </td>

                            </tr>
                          )
                        )
                      )}

                    </tbody>
                  </table>
                </div>

                {/* SAVE */}

                <div className="save-area">

                  {saveError && (
                    <span className="save-error">
                      {saveError}
                    </span>
                  )}

                  <button
                    className={
                      saved
                        ? "save-button saved"
                        : "save-button"
                    }
                    onClick={saveBatch}
                    disabled={saving}
                  >
                    {saving
                      ? "Saving..."
                      : saved
                      ? "✓ Saved Successfully"
                      : "Save Batch"}
                  </button>

                </div>
              </>
            )}
          </section>
        )}
      </main>

      {/* =====================================================
          LABBOT BUTTON
      ===================================================== */}

      <button
        className="chat-button"
        onClick={() =>
          setChatOpen(!chatOpen)
        }
        title="Open LabBot"
      >
        🤖
      </button>

      {/* =====================================================
          LABBOT
      ===================================================== */}

      {chatOpen && (
        <div className="chatbox">

          <div className="chat-header">

            <div>
              <strong>
                LabBot
              </strong>

              <span>
                Ask about your
                lab data
              </span>
            </div>

            <div className="chat-header-actions">

              <button
                type="button"
                className="chat-help-button"
                onClick={() =>
                  setShowBotHelp(
                    !showBotHelp
                  )
                }
                title="How to use LabBot"
                aria-label="How to use LabBot"
              >
                ⓘ
              </button>

              <button
                type="button"
                className="chat-close-button"
                onClick={() =>
                  setChatOpen(false)
                }
                title="Close LabBot"
                aria-label="Close LabBot"
              >
                ×
              </button>

            </div>
          </div>

          {/* HELP */}

          {showBotHelp && (
            <div className="bot-help">

              <div className="bot-help-title">
                <div>
                  <strong>
                    How to use LabBot
                  </strong>

                  <span>
                    Quick guide
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowBotHelp(false)
                  }
                  aria-label="Close help"
                >
                  ×
                </button>
              </div>

              <div className="bot-help-content">

                <p>
                  LabBot answers
                  questions using
                  the lab, batch,
                  student,
                  experiment,
                  assignment and
                  marks data saved
                  in this app.
                </p>

                <h4>
                  What can I ask?
                </h4>

                <ul>
                  <li>
                    Find submitted
                    or pending work
                  </li>

                  <li>
                    Find students
                    in a batch
                  </li>

                  <li>
                    Count students
                  </li>

                  <li>
                    Check experiment
                    or assignment
                    marks
                  </li>

                  <li>
                    Check a
                    student's total
                    marks
                  </li>
                </ul>

                <h4>
                  Common commands
                </h4>

                <div className="bot-examples">
                  {helpExamples.map(
                    (
                      example,
                      index
                    ) => (
                      <button
                        type="button"
                        key={index}
                        onClick={() => {
                          setQuestion(
                            example
                          );
                          setShowBotHelp(
                            false
                          );
                        }}
                      >
                        {example}
                      </button>
                    )
                  )}
                </div>

                <div className="bot-help-note">
                  <strong>
                    Tip:
                  </strong>{" "}
                  You can use normal
                  words such as{" "}
                  <b>done</b>,{" "}
                  <b>completed</b>,{" "}
                  <b>submitted</b>,{" "}
                  <b>pending</b>,{" "}
                  <b>who</b>,{" "}
                  <b>which</b> and{" "}
                  <b>how many</b>.
                </div>

              </div>
            </div>
          )}

          {/* MESSAGES */}

          <div className="chat-messages">
            {chatMessages.map(
              (message, index) => (
                <div
                  key={index}
                  className={
                    message.role ===
                    "user"
                      ? "message user"
                      : "message bot"
                  }
                >
                  {message.text
                    .split("\n")
                    .map(
                      (line, i) => (
                        <div key={i}>
                          {line}
                        </div>
                      )
                    )}
                </div>
              )
            )}

            {chatLoading && (
              <div className="message bot">
                Checking lab
                data...
              </div>
            )}
          </div>

          {/* INPUT */}

          <form
            className="chat-form"
            onSubmit={askBot}
          >
            <input
              value={question}
              onChange={(event) =>
                setQuestion(
                  event.target.value
                )
              }
              placeholder="Ask about your data..."
            />

            <button
              type="submit"
              disabled={chatLoading}
            >
              ➤
            </button>
          </form>

        </div>
      )}

      {/* =====================================================
          CREATE LAB
      ===================================================== */}

      {showLabForm && (
        <div className="modal-overlay">

          <form
            className="modal"
            onSubmit={createLab}
          >
            <h2>
              Create Lab
            </h2>

            <input
              placeholder="Lab name"
              value={labName}
              onChange={(event) =>
                setLabName(
                  event.target.value
                )
              }
              autoFocus
            />

            <input
              placeholder="Subject (optional)"
              value={subjectName}
              onChange={(event) =>
                setSubjectName(
                  event.target.value
                )
              }
            />

            <div className="modal-actions">

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setShowLabForm(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary"
              >
                Create
              </button>

            </div>
          </form>

        </div>
      )}

      {/* =====================================================
          CREATE BATCH
      ===================================================== */}

      {showBatchForm && (
        <div className="modal-overlay">

          <form
            className="modal"
            onSubmit={createBatch}
          >
            <h2>
              Create Batch
            </h2>

            <input
              placeholder="Example: I1"
              value={batchName}
              onChange={(event) =>
                setBatchName(
                  event.target.value
                )
              }
              autoFocus
            />

            <div className="modal-actions">

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setShowBatchForm(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary"
              >
                Create
              </button>

            </div>
          </form>

        </div>
      )}

      {/* =====================================================
          ADD COLUMN
      ===================================================== */}

      {showColumnForm && (
        <div className="modal-overlay">

          <form
            className="modal"
            onSubmit={addColumn}
          >
            <h2>
              Add Custom Column
            </h2>

            <input
              placeholder="Column name"
              value={columnName}
              onChange={(event) =>
                setColumnName(
                  event.target.value
                )
              }
              autoFocus
            />

            <select
              value={columnType}
              onChange={(event) =>
                setColumnType(
                  event.target.value
                )
              }
            >
              <option value="status">
                Submitted / Pending
              </option>

              <option value="number">
                Marks / Number
              </option>

              <option value="text">
                Text
              </option>
            </select>

            {columnType ===
              "number" && (
              <input
                type="number"
                min="1"
                placeholder="Maximum marks"
                value={columnMarks}
                onChange={(event) =>
                  setColumnMarks(
                    event.target.value
                  )
                }
              />
            )}

            <div className="modal-actions">

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setShowColumnForm(
                    false
                  )
                }
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary"
              >
                Add Column
              </button>

            </div>
          </form>

        </div>
      )}

      {/* =====================================================
          FIRST-TIME TEACHER NAME
      ===================================================== */}

      {showTeacherForm && (
        <div className="modal-overlay">

          <form
            className="modal"
            onSubmit={saveTeacherName}
          >
            <h2>
              Welcome to Lab Management
            </h2>

            <p>
              Enter your name to
              continue.
            </p>

            <input
              type="text"
              placeholder="Teacher name"
              value={teacherName}
              onChange={(event) =>
                setTeacherName(
                  event.target.value
                )
              }
              autoFocus
            />

            <div className="modal-actions">

              <button
                type="submit"
                className="primary"
              >
                Continue
              </button>

            </div>
          </form>

        </div>
      )}

    </div>
  );
}

export default App;