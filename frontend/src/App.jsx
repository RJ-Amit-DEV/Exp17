import {
  useEffect,
  useMemo,
  useState
} from "react";

import "./App.css";

const API =
  import.meta.env.VITE_API_URL ||
  "https://exp17.onrender.com/api";

const makeId = () =>
  crypto.randomUUID();

function apiFetch(url, options = {}) {
  const token =
    localStorage.getItem("teacherToken");

  const headers = {
    ...(options.headers || {})
  };

  if (token) {
    headers["x-teacher-token"] = token;
  }

  return fetch(url, {
    ...options,
    headers
  });
}

const defaultColumns = () => [
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

function App() {
  // ====================================================
  // AUTH
  // ====================================================

  const [teacher, setTeacher] =
    useState(null);

  const [teacherName, setTeacherName] =
    useState("");

  const [teacherDraft, setTeacherDraft] =
    useState("");

  const [accessCode, setAccessCode] =
    useState("");

  const [authLoading, setAuthLoading] =
    useState(true);

  const [authError, setAuthError] =
    useState("");

  const [showAuth, setShowAuth] =
    useState(false);

  const [editingTeacher, setEditingTeacher] =
    useState(false);

  // ====================================================
  // LAB
  // ====================================================

  const [labs, setLabs] =
    useState([]);

  const [selectedLabId, setSelectedLabId] =
    useState("");

  const [activeBatchId, setActiveBatchId] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  // ====================================================
  // FORMS
  // ====================================================

  const [showLabForm, setShowLabForm] =
    useState(false);

  const [showBatchForm, setShowBatchForm] =
    useState(false);

  const [showColumnForm, setShowColumnForm] =
    useState(false);

  const [labName, setLabName] =
    useState("");

  const [subjectName, setSubjectName] =
    useState("");

  const [batchName, setBatchName] =
    useState("");

  const [columnName, setColumnName] =
    useState("");

  const [columnType, setColumnType] =
    useState("status");

  const [columnMarks, setColumnMarks] =
    useState("");

  // ====================================================
  // BOT
  // ====================================================

  const [chatOpen, setChatOpen] =
    useState(false);

  const [showBotHelp, setShowBotHelp] =
    useState(false);

  const [question, setQuestion] =
    useState("");

  const [chatLoading, setChatLoading] =
    useState(false);

  const [chatMessages, setChatMessages] =
    useState([
      {
        role: "bot",
        text:
          "Hi! Ask me about your students, pending experiment files, assignments or marks."
      }
    ]);

  // ====================================================
  // AUTH CHECK
  // ====================================================

  useEffect(() => {
    async function checkSession() {
      const token =
        localStorage.getItem(
          "teacherToken"
        );

      if (!token) {
        setAuthLoading(false);
        setShowAuth(true);
        return;
      }

      try {
        const response = await apiFetch(
          `${API}/auth/me`
        );

        if (!response.ok) {
          throw new Error("Invalid session");
        }

        const data =
          await response.json();

        setTeacher(data.teacher);
        setTeacherName(
          data.teacher.name
        );
        setTeacherDraft(
          data.teacher.name
        );
        setShowAuth(false);
      } catch {
        localStorage.removeItem(
          "teacherToken"
        );

        localStorage.removeItem(
          "teacherName"
        );

        setTeacher(null);
        setShowAuth(true);
      } finally {
        setAuthLoading(false);
      }
    }

    checkSession();
  }, []);

  // ====================================================
  // LOGIN
  // ====================================================

  async function handleLogin(event) {
    event.preventDefault();

    setAuthError("");

    const name =
      teacherDraft.trim();

    const code =
      accessCode.trim();

    if (!name) {
      setAuthError(
        "Please enter your teacher name."
      );
      return;
    }

    if (!/^\d{4}$/.test(code)) {
      setAuthError(
        "Access code must contain exactly 4 digits."
      );
      return;
    }

    try {
      setAuthLoading(true);

      const response = await fetch(
        `${API}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            name,
            code
          })
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Login failed"
        );
      }

      localStorage.setItem(
        "teacherToken",
        data.token
      );

      localStorage.setItem(
        "teacherName",
        data.teacher.name
      );

      setTeacher(data.teacher);
      setTeacherName(
        data.teacher.name
      );
      setTeacherDraft(
        data.teacher.name
      );
      setAccessCode("");
      setShowAuth(false);
      setAuthError("");
    } catch (error) {
      setAuthError(
        error.message ||
          "Login failed"
      );
    } finally {
      setAuthLoading(false);
    }
  }

  // ====================================================
  // LOGOUT
  // ====================================================

  function logout() {
    localStorage.removeItem(
      "teacherToken"
    );

    localStorage.removeItem(
      "teacherName"
    );

    setTeacher(null);
    setTeacherName("");
    setTeacherDraft("");
    setLabs([]);
    setSelectedLabId("");
    setActiveBatchId("");
    setShowAuth(true);
  }

  // ====================================================
  // LOAD LABS
  // ====================================================

  async function loadLabs() {
    try {
      setLoading(true);

      const response =
        await apiFetch(
          `${API}/labs`
        );

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Failed to load labs"
        );
      }

      const data =
        await response.json();

      setLabs(data);

      if (data.length) {
        setSelectedLabId(
          (current) =>
            current || data[0]._id
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (teacher) {
      loadLabs();
    }
  }, [teacher]);

  // ====================================================
  // CURRENT LAB / BATCH
  // ====================================================

  const selectedLab =
    labs.find(
      (lab) =>
        lab._id === selectedLabId
    );

  const activeBatch =
    selectedLab?.batches?.find(
      (batch) =>
        batch.id === activeBatchId
    );

  useEffect(() => {
    if (
      selectedLab?.batches?.length &&
      !selectedLab.batches.some(
        (batch) =>
          batch.id ===
          activeBatchId
      )
    ) {
      setActiveBatchId(
        selectedLab.batches[0].id
      );
    }
  }, [
    selectedLab,
    activeBatchId
  ]);

  // ====================================================
  // SEARCH
  // ====================================================

  const visibleStudents =
    useMemo(() => {
      if (!activeBatch) {
        return [];
      }

      const q =
        search
          .toLowerCase()
          .trim();

      if (!q) {
        return activeBatch.students;
      }

      return activeBatch.students.filter(
        (student) =>
          String(
            student.name || ""
          )
            .toLowerCase()
            .includes(q) ||
          String(
            student.rollNo || ""
          )
            .toLowerCase()
            .includes(q)
      );
    }, [activeBatch, search]);

  // ====================================================
  // LAB
  // ====================================================

  async function createLab(event) {
    event.preventDefault();

    if (!labName.trim()) return;

    try {
      const response =
        await apiFetch(
          `${API}/labs`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              name: labName,
              subject:
                subjectName
            })
          }
        );

      if (response.status === 401) {
        logout();
        return;
      }

      const newLab =
        await response.json();

      if (!response.ok) {
        throw new Error(
          newLab.message ||
            "Failed to create lab"
        );
      }

      setLabs((current) => [
        newLab,
        ...current
      ]);

      setSelectedLabId(
        newLab._id
      );

      setActiveBatchId("");

      setLabName("");
      setSubjectName("");
      setShowLabForm(false);
    } catch (error) {
      alert(error.message);
    }
  }

  async function deleteLab() {
    if (!selectedLab) return;

    if (
      !window.confirm(
        `Delete "${selectedLab.name}" and all its batches?`
      )
    ) {
      return;
    }

    try {
      const response =
        await apiFetch(
          `${API}/labs/${selectedLab._id}`,
          {
            method: "DELETE"
          }
        );

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Failed to delete lab"
        );
      }

      const remaining =
        labs.filter(
          (lab) =>
            lab._id !==
            selectedLab._id
        );

      setLabs(remaining);

      setSelectedLabId(
        remaining[0]?._id || ""
      );

      setActiveBatchId("");
    } catch (error) {
      alert(error.message);
    }
  }

  async function renameLab() {
    if (!selectedLab) return;

    const newName =
      window.prompt(
        "Lab name:",
        selectedLab.name
      );

    if (!newName?.trim()) {
      return;
    }

    const newSubject =
      window.prompt(
        "Subject:",
        selectedLab.subject || ""
      );

    try {
      const response =
        await apiFetch(
          `${API}/labs/${selectedLab._id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              name: newName,
              subject:
                newSubject || ""
            })
          }
        );

      if (response.status === 401) {
        logout();
        return;
      }

      const updated =
        await response.json();

      if (!response.ok) {
        throw new Error(
          updated.message ||
            "Failed to update lab"
        );
      }

      setLabs((current) =>
        current.map((lab) =>
          lab._id === updated._id
            ? updated
            : lab
        )
      );
    } catch (error) {
      alert(error.message);
    }
  }

  // ====================================================
  // BATCH
  // ====================================================

  async function createBatch(event) {
    event.preventDefault();

    if (
      !selectedLab ||
      !batchName.trim()
    ) {
      return;
    }

    try {
      const response =
        await apiFetch(
          `${API}/labs/${selectedLab._id}/batches`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              name: batchName
            })
          }
        );

      if (response.status === 401) {
        logout();
        return;
      }

      const newBatch =
        await response.json();

      if (!response.ok) {
        throw new Error(
          newBatch.message ||
            "Failed to create batch"
        );
      }

      setLabs((current) =>
        current.map((lab) =>
          lab._id ===
          selectedLab._id
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

      setActiveBatchId(
        newBatch.id
      );

      setBatchName("");
      setShowBatchForm(false);
    } catch (error) {
      alert(error.message);
    }
  }

  async function deleteBatch() {
    if (
      !selectedLab ||
      !activeBatch
    ) {
      return;
    }

    if (
      !window.confirm(
        `Delete batch "${activeBatch.name}"?`
      )
    ) {
      return;
    }

    try {
      const response =
        await apiFetch(
          `${API}/labs/${selectedLab._id}/batches/${activeBatch.id}`,
          {
            method: "DELETE"
          }
        );

      if (response.status === 401) {
        logout();
        return;
      }

      if (!response.ok) {
        throw new Error(
          "Failed to delete batch"
        );
      }

      setLabs((current) =>
        current.map((lab) =>
          lab._id ===
          selectedLab._id
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
      alert(error.message);
    }
  }

  // ====================================================
  // LOCAL BATCH EDITING
  // ====================================================

  function updateBatch(changes) {
    if (
      !selectedLab ||
      !activeBatch
    ) {
      return;
    }

    setSaved(false);

    setLabs((current) =>
      current.map((lab) =>
        lab._id !==
        selectedLab._id
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
  }

  function updateStudent(
    studentId,
    changes
  ) {
    updateBatch({
      students:
        activeBatch.students.map(
          (student) =>
            student.id ===
            studentId
              ? {
                  ...student,
                  ...changes
                }
              : student
        )
    });
  }

  function updateStudentValue(
    studentId,
    columnId,
    value
  ) {
    const student =
      activeBatch.students.find(
        (item) =>
          item.id === studentId
      );

    if (!student) return;

    updateStudent(
      studentId,
      {
        values: {
          ...(student.values || {}),
          [columnId]: value
        }
      }
    );
  }

  function addStudent() {
    if (!activeBatch) return;

    updateBatch({
      students: [
        ...activeBatch.students,
        {
          id: makeId(),
          rollNo: "",
          name: "",
          age: "",
          values: {}
        }
      ]
    });
  }

  function deleteStudent(
    studentId
  ) {
    updateBatch({
      students:
        activeBatch.students.filter(
          (student) =>
            student.id !==
            studentId
        )
    });
  }

  // ====================================================
  // COLUMNS
  // ====================================================

  function addColumn(event) {
    event.preventDefault();

    if (
      !activeBatch ||
      !columnName.trim()
    ) {
      return;
    }

    const column = {
      id: makeId(),
      label:
        columnName.trim(),
      type: columnType,
      maxMarks:
        columnType === "number"
          ? Number(
              columnMarks
            ) || 0
          : 0
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
  }

  function deleteColumn(
    columnId
  ) {
    if (!activeBatch) return;

    const column =
      activeBatch.columns.find(
        (item) =>
          item.id === columnId
      );

    if (!column) return;

    if (
      !window.confirm(
        `Delete column "${column.label}"?`
      )
    ) {
      return;
    }

    updateBatch({
      columns:
        activeBatch.columns.filter(
          (item) =>
            item.id !== columnId
        )
    });
  }

  function updateColumn(
    columnId,
    changes
  ) {
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
  }

  // ====================================================
  // SAVE BATCH
  // ====================================================

  async function saveBatch() {
    if (
      !selectedLab ||
      !activeBatch
    ) {
      return;
    }

    try {
      setSaving(true);
      setSaved(false);

      const response =
        await apiFetch(
          `${API}/labs/${selectedLab._id}/batches/${activeBatch.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify(
              activeBatch
            )
          }
        );

      if (response.status === 401) {
        logout();
        return;
      }

      const savedBatch =
        await response.json();

      if (!response.ok) {
        throw new Error(
          savedBatch.message ||
            "Save failed"
        );
      }

      setLabs((current) =>
        current.map((lab) =>
          lab._id !==
          selectedLab._id
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
      alert(error.message);
    } finally {
      setSaving(false);
    }
  }

  // ====================================================
  // TOTAL
  // ====================================================

  function getTotal(student) {
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
            (Number.isFinite(
              value
            )
              ? value
              : 0)
          );
        },
        0
      );
  }

  // ====================================================
  // TEACHER NAME
  // ====================================================

  async function saveTeacherName(
    event
  ) {
    event.preventDefault();

    const name =
      teacherDraft.trim();

    if (!name) return;

    try {
      const response =
        await apiFetch(
          `${API}/teacher/name`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              newTeacherName:
                name
            })
          }
        );

      if (response.status === 401) {
        logout();
        return;
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Could not update teacher name"
        );
      }

      localStorage.setItem(
        "teacherName",
        data.teacher.name
      );

      setTeacher(data.teacher);
      setTeacherName(
        data.teacher.name
      );
      setTeacherDraft(
        data.teacher.name
      );
      setEditingTeacher(false);
    } catch (error) {
      alert(error.message);
    }
  }

  // ====================================================
  // LABBOT
  // ====================================================

  async function askBot(event) {
    event.preventDefault();

    const q =
      question.trim();

    if (!q || chatLoading) {
      return;
    }

    setChatMessages(
      (current) => [
        ...current,
        {
          role: "user",
          text: q
        }
      ]
    );

    setQuestion("");
    setChatLoading(true);

    try {
      const response =
        await apiFetch(
          `${API}/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({
              question: q
            })
          }
        );

      if (response.status === 401) {
        logout();
        return;
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Bot request failed"
        );
      }

      setChatMessages(
        (current) => [
          ...current,
          {
            role: "bot",
            text: data.answer
          }
        ]
      );
    } catch (error) {
      setChatMessages(
        (current) => [
          ...current,
          {
            role: "bot",
            text:
              error.message ||
              "Sorry, I could not answer that."
          }
        ]
      );
    } finally {
      setChatLoading(false);
    }
  }

  // ====================================================
  // AUTH SCREEN
  // ====================================================

  if (authLoading) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-icon">
            🔐
          </div>

          <h1>Exp17</h1>

          <p>
            Checking your teacher session...
          </p>
        </div>
      </div>
    );
  }

  if (
    showAuth ||
    !teacher
  ) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-icon">
            🎓
          </div>

          <h1>
            Lab Management
          </h1>

          <p>
            Teacher access
          </p>

          <form
            onSubmit={
              handleLogin
            }
          >
            <label>
              Teacher Name
            </label>

            <input
              value={
                teacherDraft
              }
              onChange={(event) =>
                setTeacherDraft(
                  event.target
                    .value
                )
              }
              placeholder="Enter your name"
              autoFocus
            />

            <label>
              4-Digit Access Code
            </label>

            <input
              value={
                accessCode
              }
              onChange={(event) =>
                setAccessCode(
                  event.target.value
                    .replace(
                      /\D/g,
                      ""
                    )
                    .slice(0, 4)
                )
              }
              placeholder="••••"
              inputMode="numeric"
              maxLength={4}
              type="password"
            />

            {authError && (
              <div className="auth-error">
                {authError}
              </div>
            )}

            <button
              className="primary auth-submit"
              type="submit"
              disabled={
                authLoading
              }
            >
              {authLoading
                ? "Please wait..."
                : "Continue"}
            </button>
          </form>

          <small className="auth-note">
            New teacher? Your name and
            4-digit code will create your
            teacher account automatically.
          </small>
        </div>
      </div>
    );
  }

  // ====================================================
  // MAIN UI
  // ====================================================

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>
            Lab Management
          </h1>

          <div className="teacher-line">
            Teacher:{" "}
            <strong>
              {teacherName}
            </strong>

            <button
              className="edit-teacher-btn"
              onClick={() =>
                setEditingTeacher(
                  true
                )
              }
            >
              Edit
            </button>
          </div>
        </div>

        <div className="topbar-actions">
          <button
            className="secondary"
            onClick={logout}
          >
            🔒 Lock
          </button>
        </div>
      </header>

      <main className="content">
        <section className="toolbar">
          <div className="toolbar-left">
            <button
              className="primary"
              onClick={() =>
                setShowLabForm(
                  true
                )
              }
            >
              + New Lab
            </button>

            {selectedLab && (
              <>
                <button
                  className="secondary"
                  onClick={
                    renameLab
                  }
                >
                  Edit Lab
                </button>

                <button
                  className="danger"
                  onClick={
                    deleteLab
                  }
                >
                  Delete Lab
                </button>
              </>
            )}
          </div>

          <input
            className="search-box"
            placeholder="Search student or roll no..."
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </section>

        <section className="workspace">
          <aside className="sidebar">
            <div className="sidebar-title">
              My Labs
            </div>

            {loading ? (
              <div className="empty-text">
                Loading...
              </div>
            ) : labs.length ===
              0 ? (
              <div className="empty-text">
                No labs yet.
              </div>
            ) : (
              labs.map((lab) => (
                <button
                  key={lab._id}
                  className={
                    selectedLabId ===
                    lab._id
                      ? "lab-item active"
                      : "lab-item"
                  }
                  onClick={() => {
                    setSelectedLabId(
                      lab._id
                    );
                    setActiveBatchId(
                      lab.batches?.[0]
                        ?.id || ""
                    );
                    setSearch("");
                  }}
                >
                  <strong>
                    {lab.name}
                  </strong>

                  <span>
                    {lab.subject ||
                      "No subject"}
                  </span>
                </button>
              ))
            )}
          </aside>

          <section className="main-panel">
            {!selectedLab ? (
              <div className="empty-panel">
                <h2>
                  Create your first lab
                </h2>

                <p>
                  Start by creating a lab
                  and then add batches.
                </p>

                <button
                  className="primary"
                  onClick={() =>
                    setShowLabForm(
                      true
                    )
                  }
                >
                  + Create Lab
                </button>
              </div>
            ) : (
              <>
                <div className="lab-header">
                  <div>
                    <h2>
                      {selectedLab.name}
                    </h2>

                    <p>
                      {selectedLab.subject ||
                        "No subject"}
                    </p>
                  </div>

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
                </div>

                <div className="batch-tabs">
                  {selectedLab.batches?.map(
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
                        }}
                      >
                        {batch.name}
                      </button>
                    )
                  )}
                </div>

                {!activeBatch ? (
                  <div className="empty-panel small">
                    <h3>
                      No batch selected
                    </h3>

                    <button
                      className="primary"
                      onClick={() =>
                        setShowBatchForm(
                          true
                        )
                      }
                    >
                      + Add Batch
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="batch-toolbar">
                      <div>
                        <input
                          className="batch-name-input"
                          value={
                            activeBatch.name
                          }
                          onChange={(event) =>
                            updateBatch({
                              name: event
                                .target
                                .value
                            })
                          }
                        />

                        <span className="student-count">
                          {
                            activeBatch
                              .students
                              .length
                          }{" "}
                          students
                        </span>
                      </div>

                      <div className="batch-actions">
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
                          className={
                            saved
                              ? "save-btn saved"
                              : "save-btn"
                          }
                          onClick={
                            saveBatch
                          }
                          disabled={
                            saving
                          }
                        >
                          {saving
                            ? "Saving..."
                            : saved
                            ? "✓ Saved"
                            : "Save"}
                        </button>

                        <button
                          className="danger"
                          onClick={
                            deleteBatch
                          }
                        >
                          Delete Batch
                        </button>
                      </div>
                    </div>

                    <div className="table-wrapper">
                      <table className="student-table">
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
                              (
                                column
                              ) => (
                                <th
                                  key={
                                    column.id
                                  }
                                >
                                  <div className="column-header">
                                    <span>
                                      {
                                        column.label
                                      }
                                    </span>

                                    <button
                                      className="column-delete"
                                      onClick={() =>
                                        deleteColumn(
                                          column.id
                                        )
                                      }
                                      title="Delete column"
                                    >
                                      🗑
                                    </button>
                                  </div>

                                  {column.type ===
                                    "number" &&
                                    column.maxMarks >
                                      0 && (
                                      <small>
                                        /{" "}
                                        {
                                          column.maxMarks
                                        }
                                      </small>
                                    )}
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
                          {visibleStudents.map(
                            (
                              student
                            ) => (
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
                                    type="number"
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
                                              .value
                                        }
                                      )
                                    }
                                  />
                                </td>

                                {activeBatch.columns.map(
                                  (
                                    column
                                  ) => (
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
                                          <option>
                                            Pending
                                          </option>

                                          <option>
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
                                          value={
                                            student
                                              .values?.[
                                              column
                                                .id
                                            ] ||
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

                                <td className="total-cell">
                                  {
                                    getTotal(
                                      student
                                    )
                                  }
                                </td>

                                <td>
                                  <button
                                    className="row-delete"
                                    onClick={() =>
                                      deleteStudent(
                                        student.id
                                      )
                                    }
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            )
                          )}

                          {!visibleStudents.length && (
                            <tr>
                              <td
                                colSpan={
                                  6 +
                                  activeBatch
                                    .columns
                                    .length
                                }
                                className="no-data"
                              >
                                No students found.
                                Click
                                <strong>
                                  {" "}
                                  + Student
                                </strong>{" "}
                                to add one.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </section>
      </main>

      {/* ================================================ */}
      {/* LAB FORM */}
      {/* ================================================ */}

      {showLabForm && (
        <div className="modal-backdrop">
          <form
            className="modal-card"
            onSubmit={createLab}
          >
            <h2>
              Create New Lab
            </h2>

            <label>
              Lab Name
            </label>

            <input
              autoFocus
              value={labName}
              onChange={(event) =>
                setLabName(
                  event.target.value
                )
              }
              placeholder="Web Technology Lab"
            />

            <label>
              Subject
            </label>

            <input
              value={subjectName}
              onChange={(event) =>
                setSubjectName(
                  event.target.value
                )
              }
              placeholder="Web Technology"
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
                className="primary"
                type="submit"
              >
                Create Lab
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================ */}
      {/* BATCH FORM */}
      {/* ================================================ */}

      {showBatchForm && (
        <div className="modal-backdrop">
          <form
            className="modal-card"
            onSubmit={createBatch}
          >
            <h2>
              Add Batch
            </h2>

            <label>
              Batch Name
            </label>

            <input
              autoFocus
              value={batchName}
              onChange={(event) =>
                setBatchName(
                  event.target.value
                )
              }
              placeholder="I1"
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
                className="primary"
                type="submit"
              >
                Add Batch
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================ */}
      {/* COLUMN FORM */}
      {/* ================================================ */}

      {showColumnForm && (
        <div className="modal-backdrop">
          <form
            className="modal-card"
            onSubmit={
              addColumn
            }
          >
            <h2>
              Add Custom Column
            </h2>

            <label>
              Column Name
            </label>

            <input
              autoFocus
              value={
                columnName
              }
              onChange={(
                event
              ) =>
                setColumnName(
                  event.target
                    .value
                )
              }
              placeholder="Attendance"
            />

            <label>
              Type
            </label>

            <select
              value={
                columnType
              }
              onChange={(
                event
              ) =>
                setColumnType(
                  event.target
                    .value
                )
              }
            >
              <option value="status">
                Submitted / Pending
              </option>

              <option value="number">
                Number / Marks
              </option>

              <option value="text">
                Text
              </option>
            </select>

            {columnType ===
              "number" && (
              <>
                <label>
                  Maximum Marks
                </label>

                <input
                  type="number"
                  value={
                    columnMarks
                  }
                  onChange={(
                    event
                  ) =>
                    setColumnMarks(
                      event.target
                        .value
                    )
                  }
                  placeholder="10"
                />
              </>
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
                className="primary"
                type="submit"
              >
                Add Column
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================ */}
      {/* TEACHER NAME FORM */}
      {/* ================================================ */}

      {editingTeacher && (
        <div className="modal-backdrop">
          <form
            className="modal-card"
            onSubmit={
              saveTeacherName
            }
          >
            <h2>
              Edit Teacher Name
            </h2>

            <label>
              Teacher Name
            </label>

            <input
              autoFocus
              value={
                teacherDraft
              }
              onChange={(
                event
              ) =>
                setTeacherDraft(
                  event.target
                    .value
                )
              }
            />

            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setTeacherDraft(
                    teacherName
                  );
                  setEditingTeacher(
                    false
                  );
                }}
              >
                Cancel
              </button>

              <button
                className="primary"
                type="submit"
              >
                Save Name
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================ */}
      {/* LABBOT */}
      {/* ================================================ */}

      {chatOpen && (
        <div className="chat-box">
          <div className="chat-header">
            <div>
              <strong>
                LabBot
              </strong>

              <span>
                Your lab data assistant
              </span>
            </div>

            <div className="chat-header-actions">
              <button
                className="chat-info"
                onClick={() =>
                  setShowBotHelp(
                    (value) =>
                      !value
                  )
                }
                title="LabBot help"
              >
                ⓘ
              </button>

              <button
                className="chat-close"
                onClick={() =>
                  setChatOpen(
                    false
                  )
                }
              >
                ×
              </button>
            </div>
          </div>

          {showBotHelp && (
            <div className="bot-help">
              <strong>
                You can ask:
              </strong>

              <ul>
                <li>
                  I2 pending
                  experiment files
                </li>

                <li>
                  Who submitted
                  assignment in I3?
                </li>

                <li>
                  How many students
                  are in I2?
                </li>

                <li>
                  I1 students with
                  marks below 5
                </li>

                <li>
                  Show I2 students
                </li>
              </ul>
            </div>
          )}

          <div className="chat-messages">
            {chatMessages.map(
              (
                message,
                index
              ) => (
                <div
                  key={index}
                  className={
                    message.role ===
                    "user"
                      ? "chat-message user"
                      : "chat-message bot"
                  }
                >
                  {message.text}
                </div>
              )
            )}

            {chatLoading && (
              <div className="chat-message bot">
                Checking your lab data...
              </div>
            )}
          </div>

          <form
            className="chat-input-row"
            onSubmit={
              askBot
            }
          >
            <input
              value={
                question
              }
              onChange={(
                event
              ) =>
                setQuestion(
                  event.target
                    .value
                )
              }
              placeholder="Ask about your lab..."
            />

            <button
              className="primary"
              type="submit"
              disabled={
                chatLoading
              }
            >
              Send
            </button>
          </form>
        </div>
      )}

      <button
        className="bot-float"
        onClick={() =>
          setChatOpen(
            (value) => !value
          )
        }
        title="Open LabBot"
      >
        🤖
      </button>
    </div>
  );
}

export default App;