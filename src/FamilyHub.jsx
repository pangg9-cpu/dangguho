import { useState, useEffect, useRef, useCallback } from "react";
import { Calendar, MapPin, ShoppingBag, Plus, Star, X, BookOpen, Check, Trash2, Image as ImageIcon, Download, CalendarClock, Eye, EyeOff, Pencil, ExternalLink, Package } from "lucide-react";
import { db } from "./firebase.js";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

function parsePlaceEntry(raw) {
  const idx = raw.indexOf(")");
  if (idx > 0) {
    return { region: raw.slice(0, idx).trim(), name: raw.slice(idx + 1).trim() };
  }
  return { region: "", name: raw.trim() };
}

function googleMapsUrl(placeName) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
}

function downloadPhoto(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function resizeImageFile(file, maxSize = 900, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const PALETTE = {
  paper: "#FBF7F0",
  paperDeep: "#F2EBDD",
  ink: "#2C3A3A",
  inkSoft: "#5C6B6B",
  sage: "#4F7864",
  sageDeep: "#3A5A4A",
  plum: "#8A6B8F",
  mustard: "#CE9A3E",
  coral: "#C97361",
  line: "#DCD3C0",
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
const WHO_OPTIONS = ["성현", "지윤"];
const WITH_OPTIONS = ["성현", "지윤", "없음"];
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function ddayLabel(dateStr) {
  const diff = Math.round((new Date(dateStr) - new Date(todayStr())) / 86400000);
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

const FAMILY_DOC = doc(db, "shared", "family-hub-data");

function useFamilyData() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const saveTimer = useRef(null);
  const skipNextSnapshot = useRef(false);

  useEffect(() => {
    const unsub = onSnapshot(
      FAMILY_DOC,
      (snap) => {
        if (skipNextSnapshot.current) {
          skipNextSnapshot.current = false;
          setStatus("ready");
          return;
        }
        if (snap.exists()) {
          setData(snap.data());
        } else {
          setData({ events: {}, diary: {}, places: [], shopping: [], stock: [] });
        }
        setStatus("ready");
      },
      (err) => {
        console.error("불러오기 실패", err);
        setData({ events: {}, diary: {}, places: [], shopping: [], stock: [] });
        setStatus("ready");
      }
    );
    return () => unsub();
  }, []);

  const persist = useCallback((next) => {
    setData(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        skipNextSnapshot.current = true;
        await setDoc(FAMILY_DOC, next);
      } catch (e) {
        console.error("저장 실패", e);
      }
    }, 250);
  }, []);

  return { data, status, persist };
}

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-200 focus:outline-none focus-visible:ring-2 whitespace-nowrap flex-shrink-0"
      style={{
        background: active ? PALETTE.sage : "transparent",
        color: active ? PALETTE.paper : PALETTE.inkSoft,
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <Icon size={15} strokeWidth={2} className="flex-shrink-0" />
      {label}
    </button>
  );
}

const HOURS_24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES_10 = ["00", "10", "20", "30", "40", "50"];

function TimeField({ value, onChange, bg = "white" }) {
  const isUndecided = value === "미정";
  const [h, m] = isUndecided ? ["09", "00"] : value.split(":");
  return (
    <div className="flex items-center flex-wrap gap-1">
      <select
        value={h}
        disabled={isUndecided}
        onChange={(e) => onChange(`${e.target.value}:${m}`)}
        className="px-1.5 py-1.5 rounded-lg text-sm focus:outline-none"
        style={{ background: bg, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
      >
        {HOURS_24.map((hh) => (
          <option key={hh} value={hh}>{hh}시</option>
        ))}
      </select>
      <select
        value={m}
        disabled={isUndecided}
        onChange={(e) => onChange(`${h}:${e.target.value}`)}
        className="px-1.5 py-1.5 rounded-lg text-sm focus:outline-none"
        style={{ background: bg, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
      >
        {MINUTES_10.map((mm) => (
          <option key={mm} value={mm}>{mm}분</option>
        ))}
      </select>
      <label className="flex items-center gap-0.5 text-[10px] flex-shrink-0" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
        <input type="checkbox" checked={isUndecided} onChange={(e) => onChange(e.target.checked ? "미정" : "09:00")} />
        미정
      </label>
    </div>
  );
}

function StarRow({ value, onChange, size = 18 }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange && onChange(n)}
          className={onChange ? "cursor-pointer" : "cursor-default"}
        >
          <Star
            size={size}
            fill={n <= value ? PALETTE.mustard : "none"}
            color={n <= value ? PALETTE.mustard : PALETTE.line}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

function CalendarTab({ data, persist }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(todayStr());
  const [titleInput, setTitleInput] = useState("");
  const [whoInput, setWhoInput] = useState(WHO_OPTIONS[0]);
  const [withInput, setWithInput] = useState(WITH_OPTIONS[0]);
  const [startHourInput, setStartHourInput] = useState("09:00");
  const [endHourInput, setEndHourInput] = useState("09:00");
  const [placeInput, setPlaceInput] = useState("");
  const [memoInput, setMemoInput] = useState("");
  const [eventOnCalendarInput, setEventOnCalendarInput] = useState(true);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showDiaryForm, setShowDiaryForm] = useState(false);
  const [multiDayInput, setMultiDayInput] = useState(false);
  const [importantInput, setImportantInput] = useState(false);
  const [eventEndDateInput, setEventEndDateInput] = useState("");
  const [diaryTitleInput, setDiaryTitleInput] = useState("");
  const [diaryAuthorInput, setDiaryAuthorInput] = useState(WHO_OPTIONS[0]);
  const [diaryPlaceInputs, setDiaryPlaceInputs] = useState([""]);
  const [journalInput, setJournalInput] = useState("");
  const [diaryOnCalendarInput, setDiaryOnCalendarInput] = useState(true);
  const [photoInput, setPhotoInput] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [movingEventId, setMovingEventId] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [movingDiaryId, setMovingDiaryId] = useState(null);
  const [editingDiaryId, setEditingDiaryId] = useState(null);
  const [diaryEditDraft, setDiaryEditDraft] = useState(null);
  const [editPhotoBusy, setEditPhotoBusy] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const editFileRef = useRef(null);
  const fileRef = useRef(null);

  const { y, m } = cursor;
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const dateKey = (d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const getEventsForDate = (dateStr) => {
    const result = [];
    Object.entries(data.events || {}).forEach(([storageDate, list]) => {
      (list || []).forEach((ev) => {
        const end = ev.endDate || storageDate;
        if (dateStr >= storageDate && dateStr <= end) {
          result.push({ ...ev, _storageDate: storageDate });
        }
      });
    });
    return result;
  };

  const events = getEventsForDate(selected);
  const diary = (data.diary && data.diary[selected]) || [];
  const places = data.places || [];

  const handlePhotoPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await resizeImageFile(file);
      setPhotoInput(dataUrl);
    } catch (err) {
      console.error("사진 처리 실패", err);
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const addEvent = () => {
    if (!titleInput.trim()) return;
    const next = { ...data };
    next.events = { ...next.events };
    const list = next.events[selected] ? [...next.events[selected]] : [];
    list.push({
      id: Date.now().toString(36),
      title: titleInput.trim(),
      who: whoInput,
      companion: withInput,
      startHour: startHourInput,
      endHour: endHourInput,
      place: placeInput.trim(),
      memo: memoInput.trim(),
      endDate: multiDayInput && eventEndDateInput && eventEndDateInput > selected ? eventEndDateInput : null,
      onCalendar: eventOnCalendarInput,
      important: importantInput,
      done: false,
      createdAt: new Date().toISOString(),
    });
    next.events[selected] = list;
    persist(next);
    setTitleInput("");
    setPlaceInput("");
    setMemoInput("");
    setStartHourInput("09:00");
    setEndHourInput("09:00");
    setMultiDayInput(false);
    setEventEndDateInput("");
    setImportantInput(false);
    setShowEventForm(false);
  };

  const removeEvent = (id, dateKeyArg) => {
    const next = { ...data };
    next.events = { ...next.events };
    next.events[dateKeyArg] = (next.events[dateKeyArg] || []).filter((e) => e.id !== id);
    persist(next);
  };

  const toggleEventDone = (id, dateKeyArg) => {
    const next = { ...data };
    next.events = { ...next.events };
    next.events[dateKeyArg] = (next.events[dateKeyArg] || []).map((e) => (e.id === id ? { ...e, done: !e.done } : e));
    persist(next);
  };

  const toggleEventCalendar = (id, dateKeyArg) => {
    const next = { ...data };
    next.events = { ...next.events };
    next.events[dateKeyArg] = (next.events[dateKeyArg] || []).map((e) =>
      e.id === id ? { ...e, onCalendar: e.onCalendar === false ? true : false } : e
    );
    persist(next);
  };

  const startEditEvent = (ev) => {
    setEditingEventId(ev.id);
    setEditDraft({
      title: ev.title || "",
      who: ev.who || WHO_OPTIONS[0],
      companion: ev.companion || WITH_OPTIONS[0],
      startHour: ev.startHour || "미정",
      endHour: ev.endHour || "미정",
      place: ev.place || "",
      memo: ev.memo || "",
      endDate: ev.endDate || "",
      important: !!ev.important,
      _storageDate: ev._storageDate,
    });
    setMovingEventId(null);
  };

  const cancelEditEvent = () => {
    setEditingEventId(null);
    setEditDraft(null);
  };

  const saveEditEvent = (id) => {
    if (!editDraft || !editDraft.title.trim()) return;
    const dateKeyArg = editDraft._storageDate;
    const next = { ...data };
    next.events = { ...next.events };
    next.events[dateKeyArg] = (next.events[dateKeyArg] || []).map((e) =>
      e.id === id
        ? {
            ...e,
            title: editDraft.title.trim(),
            who: editDraft.who,
            companion: editDraft.companion,
            startHour: editDraft.startHour,
            endHour: editDraft.endHour,
            place: editDraft.place.trim(),
            memo: editDraft.memo.trim(),
            endDate: editDraft.endDate && editDraft.endDate > dateKeyArg ? editDraft.endDate : null,
            important: editDraft.important,
          }
        : e
    );
    persist(next);
    setEditingEventId(null);
    setEditDraft(null);
  };

  const moveEvent = (id, dateKeyArg, newDate) => {
    if (!newDate || newDate === dateKeyArg) {
      setMovingEventId(null);
      return;
    }
    const item = (data.events[dateKeyArg] || []).find((e) => e.id === id);
    if (!item) return;
    let movedItem = item;
    if (item.endDate && item.endDate > dateKeyArg) {
      const diffDays = Math.round((new Date(item.endDate) - new Date(dateKeyArg)) / 86400000);
      const newEnd = new Date(newDate);
      newEnd.setDate(newEnd.getDate() + diffDays);
      const newEndStr = `${newEnd.getFullYear()}-${String(newEnd.getMonth() + 1).padStart(2, "0")}-${String(newEnd.getDate()).padStart(2, "0")}`;
      movedItem = { ...item, endDate: newEndStr };
    }
    const next = { ...data };
    next.events = { ...next.events };
    next.events[dateKeyArg] = (next.events[dateKeyArg] || []).filter((e) => e.id !== id);
    next.events[newDate] = next.events[newDate] ? [...next.events[newDate], movedItem] : [movedItem];
    persist(next);
    setMovingEventId(null);
  };

  const addDiary = () => {
    if (!diaryTitleInput.trim() && !journalInput.trim() && !photoInput) return;
    const next = { ...data };
    next.diary = { ...next.diary };
    next.places = [...(next.places || [])];

    const placeNames = [...new Set(diaryPlaceInputs.map((s) => s.trim()).filter(Boolean))];
    const placeIds = [];
    placeNames.forEach((raw) => {
      const { region, name: placeName } = parsePlaceEntry(raw);
      const existing = next.places.find((p) => p.name.toLowerCase() === placeName.toLowerCase());
      if (existing) {
        placeIds.push(existing.id);
      } else {
        const newPlace = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name: placeName,
          region,
          review: "",
          rating: 0,
          best: false,
          x: 25 + Math.random() * 50,
          y: 25 + Math.random() * 50,
          addedAt: new Date().toISOString(),
        };
        next.places.push(newPlace);
        placeIds.push(newPlace.id);
      }
    });

    const list = next.diary[selected] ? [...next.diary[selected]] : [];
    list.push({
      id: Date.now().toString(36),
      title: diaryTitleInput.trim(),
      author: diaryAuthorInput,
      journal: journalInput.trim(),
      photo: photoInput || null,
      placeIds,
      comments: [],
      onCalendar: diaryOnCalendarInput,
      createdAt: new Date().toISOString(),
    });
    next.diary[selected] = list;
    persist(next);
    setDiaryTitleInput("");
    setJournalInput("");
    setPhotoInput(null);
    setDiaryPlaceInputs([""]);
    setShowDiaryForm(false);
  };

  const updateDiaryPlaceInput = (index, value) => {
    setDiaryPlaceInputs((arr) => arr.map((v, i) => (i === index ? value : v)));
  };

  const addDiaryPlaceInputField = () => {
    setDiaryPlaceInputs((arr) => [...arr, ""]);
  };

  const removeDiaryPlaceInputField = (index) => {
    setDiaryPlaceInputs((arr) => (arr.length > 1 ? arr.filter((_, i) => i !== index) : arr));
  };

  const startEditDiary = (d) => {
    const currentPlaceIds = d.placeIds && d.placeIds.length ? d.placeIds : d.placeId ? [d.placeId] : [];
    const placeNames = currentPlaceIds.map((id) => (places.find((p) => p.id === id) || {}).name).filter(Boolean);
    setDiaryEditDraft({
      title: d.title || "",
      author: d.author || WHO_OPTIONS[0],
      journal: d.journal || "",
      photo: d.photo || null,
      placeNames: placeNames.length ? placeNames : [""],
    });
    setEditingDiaryId(d.id);
    setMovingDiaryId(null);
  };

  const cancelEditDiary = () => {
    setEditingDiaryId(null);
    setDiaryEditDraft(null);
  };

  const updateEditPlace = (idx, val) => {
    setDiaryEditDraft((d) => ({ ...d, placeNames: d.placeNames.map((v, i) => (i === idx ? val : v)) }));
  };

  const addEditPlaceField = () => {
    setDiaryEditDraft((d) => ({ ...d, placeNames: [...d.placeNames, ""] }));
  };

  const removeEditPlaceField = (idx) => {
    setDiaryEditDraft((d) => (d.placeNames.length > 1 ? { ...d, placeNames: d.placeNames.filter((_, i) => i !== idx) } : d));
  };

  const handleEditPhotoPick = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setEditPhotoBusy(true);
    try {
      const dataUrl = await resizeImageFile(file);
      setDiaryEditDraft((d) => ({ ...d, photo: dataUrl }));
    } catch (err) {
      console.error("사진 처리 실패", err);
    } finally {
      setEditPhotoBusy(false);
      if (editFileRef.current) editFileRef.current.value = "";
    }
  };

  const saveEditDiary = (id) => {
    if (!diaryEditDraft) return;
    const next = { ...data };
    next.diary = { ...next.diary };
    next.places = [...(next.places || [])];

    const placeNames = [...new Set(diaryEditDraft.placeNames.map((s) => s.trim()).filter(Boolean))];
    const placeIds = [];
    placeNames.forEach((raw) => {
      const { region, name } = parsePlaceEntry(raw);
      const existing = next.places.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        placeIds.push(existing.id);
      } else {
        const newPlace = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          name,
          region,
          review: "",
          rating: 0,
          best: false,
          x: 25 + Math.random() * 50,
          y: 25 + Math.random() * 50,
          addedAt: new Date().toISOString(),
        };
        next.places.push(newPlace);
        placeIds.push(newPlace.id);
      }
    });

    next.diary[selected] = (next.diary[selected] || []).map((d) =>
      d.id === id
        ? {
            ...d,
            title: diaryEditDraft.title.trim(),
            author: diaryEditDraft.author,
            journal: diaryEditDraft.journal.trim(),
            photo: diaryEditDraft.photo || null,
            placeIds,
          }
        : d
    );
    persist(next);
    setEditingDiaryId(null);
    setDiaryEditDraft(null);
  };

  const getCommentDraft = (entryId) => commentDrafts[entryId] || { text: "", author: WHO_OPTIONS[0] };

  const updateCommentDraft = (entryId, patch) => {
    setCommentDrafts((prev) => ({ ...prev, [entryId]: { ...getCommentDraft(entryId), ...patch } }));
  };

  const addComment = (entryId) => {
    const draft = getCommentDraft(entryId);
    if (!draft.text.trim()) return;
    const next = { ...data };
    next.diary = { ...next.diary };
    next.diary[selected] = (next.diary[selected] || []).map((d) =>
      d.id === entryId
        ? {
            ...d,
            comments: [
              ...(d.comments || []),
              { id: Date.now().toString(36), author: draft.author, text: draft.text.trim(), createdAt: new Date().toISOString() },
            ],
          }
        : d
    );
    persist(next);
    setCommentDrafts((prev) => ({ ...prev, [entryId]: { text: "", author: draft.author } }));
  };

  const removeComment = (entryId, commentId) => {
    const next = { ...data };
    next.diary = { ...next.diary };
    next.diary[selected] = (next.diary[selected] || []).map((d) =>
      d.id === entryId ? { ...d, comments: (d.comments || []).filter((c) => c.id !== commentId) } : d
    );
    persist(next);
  };

  const startEditComment = (commentId, text) => {
    setEditingCommentId(commentId);
    setEditingCommentText(text);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const saveEditComment = (entryId, commentId) => {
    if (!editingCommentText.trim()) return;
    const next = { ...data };
    next.diary = { ...next.diary };
    next.diary[selected] = (next.diary[selected] || []).map((d) =>
      d.id === entryId
        ? { ...d, comments: (d.comments || []).map((c) => (c.id === commentId ? { ...c, text: editingCommentText.trim() } : c)) }
        : d
    );
    persist(next);
    setEditingCommentId(null);
    setEditingCommentText("");
  };

  const removeDiary = (id) => {
    const next = { ...data };
    next.diary = { ...next.diary };
    next.diary[selected] = (next.diary[selected] || []).filter((d) => d.id !== id);
    persist(next);
  };

  const toggleDiaryCalendar = (id) => {
    const next = { ...data };
    next.diary = { ...next.diary };
    next.diary[selected] = (next.diary[selected] || []).map((d) =>
      d.id === id ? { ...d, onCalendar: d.onCalendar === false ? true : false } : d
    );
    persist(next);
  };

  const moveDiary = (id, newDate) => {
    if (!newDate || newDate === selected) {
      setMovingDiaryId(null);
      return;
    }
    const item = (data.diary[selected] || []).find((d) => d.id === id);
    if (!item) return;
    const next = { ...data };
    next.diary = { ...next.diary };
    next.diary[selected] = (next.diary[selected] || []).filter((d) => d.id !== id);
    next.diary[newDate] = next.diary[newDate] ? [...next.diary[newDate], item] : [item];
    persist(next);
    setMovingDiaryId(null);
  };

  const upcomingImportant = Object.entries(data.events || {})
    .flatMap(([storageDate, list]) => (list || []).filter((e) => e.important).map((e) => ({ ...e, _storageDate: storageDate })))
    .sort(
      (a, b) =>
        Math.abs(new Date(a._storageDate) - new Date(todayStr())) - Math.abs(new Date(b._storageDate) - new Date(todayStr()))
    )
    .slice(0, 3);

  return (
    <div>
      {upcomingImportant.length > 0 && (
        <div className="rounded-2xl px-3.5 py-2.5 mb-4" style={{ background: PALETTE.paperDeep }}>
          <div className="flex items-center flex-wrap gap-1.5 text-xs" style={{ color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}>
            {upcomingImportant.map((ev, idx) => (
              <span key={ev.id} className="flex items-center gap-1.5">
                {idx > 0 && <span style={{ color: PALETTE.line }}>|</span>}
                <span className="font-bold" style={{ color: PALETTE.coral, fontFamily: "'Jua', sans-serif" }}>
                  {ddayLabel(ev._storageDate)}
                </span>
                <span>{ev.title}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
      <div className="md:col-span-3 rounded-3xl p-5" style={{ background: "white", border: `1px solid ${PALETTE.line}` }}>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70"
            style={{ color: PALETTE.ink }}
          >
            ‹
          </button>
          <div className="flex items-center gap-1.5">
            <select
              value={y}
              onChange={(e) => setCursor((c) => ({ ...c, y: parseInt(e.target.value, 10) }))}
              className="text-xl px-1 py-0.5 rounded-lg focus:outline-none"
              style={{ fontFamily: "'Noto Sans KR', sans-serif", color: PALETTE.ink, background: "transparent" }}
            >
              {Array.from({ length: 21 }, (_, i) => y - 10 + i).map((yy) => (
                <option key={yy} value={yy}>{yy}년</option>
              ))}
            </select>
            <select
              value={m}
              onChange={(e) => setCursor((c) => ({ ...c, m: parseInt(e.target.value, 10) }))}
              className="text-xl px-1 py-0.5 rounded-lg focus:outline-none"
              style={{ fontFamily: "'Noto Sans KR', sans-serif", color: PALETTE.ink, background: "transparent" }}
            >
              {Array.from({ length: 12 }, (_, i) => i).map((mm) => (
                <option key={mm} value={mm}>{mm + 1}월</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70"
            style={{ color: PALETTE.ink }}
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 mb-2">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className="text-center text-xs font-medium py-1"
              style={{ color: i === 0 ? PALETTE.coral : i === 6 ? PALETTE.sage : PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = dateKey(d);
            const visibleEvents = getEventsForDate(key).filter((e) => e.onCalendar !== false);
            const visibleDiary = ((data.diary && data.diary[key]) || []).filter((dd) => dd.onCalendar !== false && dd.title);
            const hasDiary = data.diary && data.diary[key] && data.diary[key].length > 0;
            const isSelected = key === selected;
            const isToday = key === todayStr();
            const tags = [
              ...visibleEvents.map((ev) => ({ id: `e-${ev.id}`, title: ev.title, done: ev.done, kind: "event", who: ev.who })),
              ...visibleDiary.map((dd) => ({ id: `d-${dd.id}`, title: dd.title, done: false, kind: "diary", who: dd.author })),
            ];
            const shownTags = tags.slice(0, 2);
            const moreCount = tags.length - shownTags.length;
            return (
              <button
                key={i}
                onClick={() => setSelected(key)}
                className="rounded-xl flex flex-col items-start p-1 relative transition-colors text-left overflow-hidden"
                style={{
                  minHeight: "64px",
                  background: isSelected ? PALETTE.sage : isToday ? PALETTE.paperDeep : "transparent",
                  color: isSelected ? PALETTE.paper : PALETTE.ink,
                }}
              >
                <div className="flex items-center justify-between w-full">
                  <span style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: "12px" }}>{d}</span>
                  {hasDiary && (
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: isSelected ? PALETTE.paper : PALETTE.coral }}
                    />
                  )}
                </div>
                <div className="w-full mt-0.5 space-y-0.5">
                  {shownTags.map((t) => {
                    const tagColors =
                      t.who === "성현"
                        ? { bg: "#DCE9F7", text: "#1B4D8C" }
                        : t.who === "지윤"
                        ? { bg: "#F9DCEA", text: "#9C1B5E" }
                        : { bg: t.kind === "event" ? PALETTE.paperDeep : "#F2E4EA", text: PALETTE.ink };
                    return (
                      <div
                        key={t.id}
                        className="w-full overflow-x-auto whitespace-nowrap no-scrollbar rounded px-1 text-left"
                        style={{
                          fontSize: "10px",
                          fontFamily: t.kind === "event" ? "'Jua', sans-serif" : "'Noto Sans KR', sans-serif",
                          fontWeight: t.kind === "event" ? 700 : 500,
                          fontStyle: t.kind === "diary" ? "italic" : "normal",
                          color: isSelected ? PALETTE.sageDeep : tagColors.text,
                          background: isSelected ? "white" : tagColors.bg,
                          textDecoration: t.done ? "line-through" : "none",
                          opacity: t.done ? 0.6 : 1,
                        }}
                      >
                        {t.title}
                      </div>
                    );
                  })}
                  {moreCount > 0 && (
                    <div
                      className="text-left px-1"
                      style={{ fontSize: "10px", color: isSelected ? PALETTE.paper : PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}
                    >
                      +{moreCount}개
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="md:col-span-2 rounded-3xl p-5 flex flex-col gap-5" style={{ background: PALETTE.paperDeep, border: `1px solid ${PALETTE.line}` }}>
        <div className="flex items-center gap-2" style={{ color: PALETTE.sageDeep }}>
          <span style={{ fontFamily: "'Noto Sans KR', sans-serif", fontSize: "12px" }}>{selected}</span>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2" style={{ color: PALETTE.sageDeep }}>
            <Calendar size={14} />
            <span className="text-sm font-medium" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>일정</span>
          </div>
          <div className="space-y-2 mb-2" style={{ maxHeight: "180px", overflowY: "auto" }}>
            {events.length === 0 && (
              <div className="text-xs py-2" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
                아직 일정이 없어요.
              </div>
            )}
            {events.map((ev) => (
              <div key={ev.id} className="rounded-xl px-3 py-2 group" style={{ background: "white" }}>
                {editingEventId === ev.id ? (
                  <div className="space-y-1.5">
                    <input
                      value={editDraft.title}
                      onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                      placeholder="일정 제목"
                      className="w-full px-2 py-1.5 rounded-lg text-sm font-bold focus:outline-none"
                      style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Jua', sans-serif" }}
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <select
                        value={editDraft.who}
                        onChange={(e) => setEditDraft({ ...editDraft, who: e.target.value })}
                        className="px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                        style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                      >
                        {WHO_OPTIONS.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                      <select
                        value={editDraft.companion}
                        onChange={(e) => setEditDraft({ ...editDraft, companion: e.target.value })}
                        className="px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                        style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                      >
                        {WITH_OPTIONS.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      value={editDraft.place}
                      onChange={(e) => setEditDraft({ ...editDraft, place: e.target.value })}
                      placeholder="장소"
                      className="w-full px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                      style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                    />
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>시작</span>
                        <TimeField value={editDraft.startHour} onChange={(v) => setEditDraft({ ...editDraft, startHour: v })} bg={PALETTE.paperDeep} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>종료</span>
                        <TimeField value={editDraft.endHour} onChange={(v) => setEditDraft({ ...editDraft, endHour: v })} bg={PALETTE.paperDeep} />
                      </div>
                    </div>
                    <input
                      value={editDraft.memo}
                      onChange={(e) => setEditDraft({ ...editDraft, memo: e.target.value })}
                      placeholder="메모"
                      className="w-full px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                      style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Pretendard', sans-serif" }}
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>
                        {editDraft._storageDate} ~ (종료일, 하루 일정이면 비워두세요)
                      </span>
                    </div>
                    <input
                      type="date"
                      value={editDraft.endDate}
                      min={editDraft._storageDate}
                      onChange={(e) => setEditDraft({ ...editDraft, endDate: e.target.value })}
                      className="w-full px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                      style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                    />
                    <label className="flex items-center gap-1.5 text-xs" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
                      <input type="checkbox" checked={editDraft.important} onChange={(e) => setEditDraft({ ...editDraft, important: e.target.checked })} />
                      중요한 일정 (디데이 표시)
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEditEvent(ev.id)}
                        className="flex-1 py-1.5 rounded-lg text-sm font-medium"
                        style={{ background: PALETTE.sage, color: "white", fontFamily: "'Noto Sans KR', sans-serif" }}
                      >
                        저장
                      </button>
                      <button
                        onClick={cancelEditEvent}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ background: PALETTE.paperDeep, color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleEventDone(ev.id, ev._storageDate)}
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: ev.done ? PALETTE.sage : "transparent",
                          border: `1.5px solid ${ev.done ? PALETTE.sage : PALETTE.line}`,
                        }}
                      >
                        {ev.done && <Check size={12} color="white" />}
                      </button>
                      <div className="flex-1 min-w-0 flex items-baseline gap-1.5 overflow-x-auto whitespace-nowrap no-scrollbar">
                        <span
                          className="text-sm font-bold flex-shrink-0"
                          style={{
                            color: ev.done ? PALETTE.inkSoft : PALETTE.ink,
                            textDecoration: ev.done ? "line-through" : "none",
                            fontFamily: "'Jua', sans-serif",
                          }}
                        >
                          {ev.title}
                        </span>
                        {ev.important && (
                          <span
                            className="text-xs flex-shrink-0 px-1.5 rounded-full font-bold"
                            style={{ color: "white", background: PALETTE.coral, fontFamily: "'Noto Sans KR', sans-serif" }}
                          >
                            {ddayLabel(ev._storageDate)}
                          </span>
                        )}
                        {ev.endDate && (
                          <span
                            className="text-xs flex-shrink-0 px-1 rounded"
                            style={{ color: PALETTE.sageDeep, background: PALETTE.paperDeep, fontFamily: "'Noto Sans KR', sans-serif" }}
                          >
                            {ev._storageDate.slice(5).replace("-", "/")}~{ev.endDate.slice(5).replace("-", "/")}
                          </span>
                        )}
                        {(ev.who || ev.companion) && (
                          <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>
                            ·{" "}
                            {ev.companion === "성현" || ev.companion === "지윤"
                              ? [ev.who, ev.companion].filter(Boolean).join(" + ")
                              : ev.companion === "없음"
                              ? `${ev.who} 혼자`
                              : ev.who}
                          </span>
                        )}
                        {ev.place && (
                          <span className="text-xs flex-shrink-0" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
                            / {ev.place}
                          </span>
                        )}
                        {(ev.startHour !== "미정" || ev.endHour !== "미정") && (
                          <span className="text-xs flex-shrink-0" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
                            / {ev.startHour === "미정" ? "미정" : ev.startHour}~{ev.endHour === "미정" ? "미정" : ev.endHour}
                          </span>
                        )}
                        {ev.memo && (
                          <span className="text-xs flex-shrink-0" style={{ color: PALETTE.inkSoft, fontFamily: "'Pretendard', sans-serif" }}>
                            / {ev.memo}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => startEditEvent(ev)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        style={{ color: PALETTE.inkSoft }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => toggleEventCalendar(ev.id, ev._storageDate)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        style={{ color: ev.onCalendar === false ? PALETTE.inkSoft : PALETTE.sage }}
                        title="캘린더에 표시"
                      >
                        {ev.onCalendar === false ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => setMovingEventId(movingEventId === ev.id ? null : ev.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        style={{ color: movingEventId === ev.id ? PALETTE.sage : PALETTE.inkSoft }}
                      >
                        <CalendarClock size={14} />
                      </button>
                      <button onClick={() => removeEvent(ev.id, ev._storageDate)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ color: PALETTE.coral }}>
                        <X size={13} />
                      </button>
                    </div>
                    {movingEventId === ev.id && (
                      <div className="flex items-center gap-1.5 mt-2 pl-7">
                        <input
                          type="date"
                          defaultValue={ev._storageDate}
                          onChange={(e) => moveEvent(ev.id, ev._storageDate, e.target.value)}
                          className="px-2 py-1 rounded-lg text-xs focus:outline-none"
                          style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                        />
                        <span className="text-xs" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>날짜 선택 시 바로 이동돼요</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowEventForm((v) => !v)}
            className="w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 mb-1.5"
            style={{
              background: showEventForm ? PALETTE.paperDeep : PALETTE.sage,
              color: showEventForm ? PALETTE.inkSoft : PALETTE.paper,
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            {showEventForm ? (
              <>
                <X size={16} /> 입력 닫기
              </>
            ) : (
              <>
                <Plus size={16} /> 일정 추가
              </>
            )}
          </button>

          {showEventForm && (
          <div className="space-y-1.5">
            <input
              value={titleInput}
              onChange={(ev) => setTitleInput(ev.target.value)}
              onKeyDown={(ev) => ev.key === "Enter" && addEvent()}
              placeholder="일정 제목 (예: 저녁 산책)"
              className="w-full px-3 py-2 rounded-xl text-sm font-bold focus:outline-none"
              style={{ background: "white", color: PALETTE.ink, fontFamily: "'Jua', sans-serif" }}
            />

            <table className="w-full border-collapse hidden md:table" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr>
                  {["WHO's", "동반", "장소", "시작", "종료"].map((h) => (
                    <th
                      key={h}
                      className="text-xs font-medium text-left px-1.5 pb-1"
                      style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-1">
                    <select
                      value={whoInput}
                      onChange={(ev) => setWhoInput(ev.target.value)}
                      className="w-full px-2 py-2 rounded-xl text-sm focus:outline-none"
                      style={{ background: "white", color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                    >
                      {WHO_OPTIONS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1">
                    <select
                      value={withInput}
                      onChange={(ev) => setWithInput(ev.target.value)}
                      className="w-full px-2 py-2 rounded-xl text-sm focus:outline-none"
                      style={{ background: "white", color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                    >
                      {WITH_OPTIONS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-1">
                    <input
                      value={placeInput}
                      onChange={(ev) => setPlaceInput(ev.target.value)}
                      placeholder="장소"
                      className="w-full px-2 py-2 rounded-xl text-sm focus:outline-none"
                      style={{ background: "white", color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                    />
                  </td>
                  <td className="px-1">
                    <TimeField value={startHourInput} onChange={setStartHourInput} />
                  </td>
                  <td className="px-1">
                    <TimeField value={endHourInput} onChange={setEndHourInput} />
                  </td>
                </tr>
              </tbody>
            </table>
            <input
              value={memoInput}
              onChange={(ev) => setMemoInput(ev.target.value)}
              placeholder="메모 (선택)"
              className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none hidden md:block"
              style={{ background: "white", color: PALETTE.ink, fontFamily: "'Pretendard', sans-serif" }}
            />

            <div className="md:hidden rounded-xl p-2.5 space-y-1.5" style={{ background: "white" }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>WHO's</span>
                <select
                  value={whoInput}
                  onChange={(ev) => setWhoInput(ev.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                >
                  {WHO_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>동반</span>
                <select
                  value={withInput}
                  onChange={(ev) => setWithInput(ev.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                >
                  {WITH_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>장소</span>
                <input
                  value={placeInput}
                  onChange={(ev) => setPlaceInput(ev.target.value)}
                  placeholder="예: 거실"
                  className="flex-1 px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>시작</span>
                <div className="flex-1">
                  <TimeField value={startHourInput} onChange={setStartHourInput} bg={PALETTE.paperDeep} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>종료</span>
                <div className="flex-1">
                  <TimeField value={endHourInput} onChange={setEndHourInput} bg={PALETTE.paperDeep} />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>메모</span>
                <input
                  value={memoInput}
                  onChange={(ev) => setMemoInput(ev.target.value)}
                  placeholder="선택 사항"
                  className="flex-1 px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Pretendard', sans-serif" }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
                <input type="checkbox" checked={multiDayInput} onChange={(ev) => setMultiDayInput(ev.target.checked)} />
                여러 날에 걸친 일정
              </label>
              {multiDayInput && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>
                    {selected} ~
                  </span>
                  <input
                    type="date"
                    value={eventEndDateInput}
                    min={selected}
                    onChange={(ev) => setEventEndDateInput(ev.target.value)}
                    className="flex-1 px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                    style={{ background: "white", color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                  />
                </div>
              )}
            </div>

            <label className="flex items-center gap-1.5 text-xs" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
              <input type="checkbox" checked={eventOnCalendarInput} onChange={(ev) => setEventOnCalendarInput(ev.target.checked)} />
              캘린더에 제목 표시
            </label>

            <label className="flex items-center gap-1.5 text-xs" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
              <input type="checkbox" checked={importantInput} onChange={(ev) => setImportantInput(ev.target.checked)} />
              중요한 일정 (디데이 표시)
            </label>

            <button
              onClick={addEvent}
              className="w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
              style={{ background: PALETTE.sage, color: PALETTE.paper, fontFamily: "'Noto Sans KR', sans-serif" }}
            >
              <Plus size={16} /> 일정 추가
            </button>
          </div>
          )}
        </div>

        <div className="pt-4" style={{ borderTop: `1px solid ${PALETTE.line}` }}>
          <div className="flex items-center gap-1.5 mb-2" style={{ color: PALETTE.sageDeep }}>
            <BookOpen size={14} />
            <span className="text-sm font-medium" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>일기</span>
          </div>

          <div className="space-y-3 mb-3" style={{ maxHeight: "220px", overflowY: "auto" }}>
            {diary.length === 0 && (
              <div className="text-xs py-2" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
                아직 남긴 일기가 없어요.
              </div>
            )}
            {diary.map((dEntry) => (
              <div key={dEntry.id} className="rounded-2xl p-3 relative group" style={{ background: "white" }}>
                {editingDiaryId === dEntry.id ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <input
                        value={diaryEditDraft.title}
                        onChange={(e) => setDiaryEditDraft({ ...diaryEditDraft, title: e.target.value })}
                        placeholder="일기 제목 (선택)"
                        className="flex-1 px-2 py-1.5 rounded-lg text-sm font-bold focus:outline-none"
                        style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                      />
                      <select
                        value={diaryEditDraft.author}
                        onChange={(e) => setDiaryEditDraft({ ...diaryEditDraft, author: e.target.value })}
                        className="px-2 py-1.5 rounded-lg text-sm flex-shrink-0 focus:outline-none"
                        style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                      >
                        {WHO_OPTIONS.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                    {diaryEditDraft.placeNames.map((val, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <MapPin size={13} style={{ color: PALETTE.sageDeep, flexShrink: 0 }} />
                        <input
                          value={val}
                          onChange={(e) => updateEditPlace(idx, e.target.value)}
                          placeholder="지역)장소"
                          list="diary-place-suggestions"
                          className="flex-1 px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                          style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                        />
                        {idx === diaryEditDraft.placeNames.length - 1 ? (
                          <button
                            type="button"
                            onClick={addEditPlaceField}
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: PALETTE.paperDeep, color: PALETTE.sageDeep }}
                          >
                            <Plus size={14} />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => removeEditPlaceField(idx)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: PALETTE.paperDeep, color: PALETTE.coral }}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                    <textarea
                      value={diaryEditDraft.journal}
                      onChange={(e) => setDiaryEditDraft({ ...diaryEditDraft, journal: e.target.value })}
                      placeholder="오늘의 짧은 일기…"
                      rows={2}
                      className="w-full px-2 py-1.5 rounded-lg text-sm resize-none focus:outline-none"
                      style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                    />
                    {diaryEditDraft.photo ? (
                      <div className="relative">
                        <img src={diaryEditDraft.photo} alt="첨부 미리보기" className="w-full rounded-xl object-cover" style={{ maxHeight: "140px" }} />
                        <button
                          onClick={() => setDiaryEditDraft({ ...diaryEditDraft, photo: null })}
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: "white", color: PALETTE.coral }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => editFileRef.current && editFileRef.current.click()}
                        disabled={editPhotoBusy}
                        className="w-full py-2 rounded-lg text-sm flex items-center justify-center gap-1.5"
                        style={{ background: PALETTE.paperDeep, color: PALETTE.inkSoft, border: `1px dashed ${PALETTE.line}`, fontFamily: "'Noto Sans KR', sans-serif" }}
                      >
                        <ImageIcon size={15} /> {editPhotoBusy ? "처리 중…" : "사진 첨부"}
                      </button>
                    )}
                    <input ref={editFileRef} type="file" accept="image/*" onChange={handleEditPhotoPick} className="hidden" />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEditDiary(dEntry.id)}
                        className="flex-1 py-1.5 rounded-lg text-sm font-medium"
                        style={{ background: PALETTE.sage, color: "white", fontFamily: "'Noto Sans KR', sans-serif" }}
                      >
                        저장
                      </button>
                      <button
                        onClick={cancelEditDiary}
                        className="px-3 py-1.5 rounded-lg text-sm"
                        style={{ background: PALETTE.paperDeep, color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEditDiary(dEntry)}
                        style={{ color: PALETTE.inkSoft }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => toggleDiaryCalendar(dEntry.id)}
                        style={{ color: dEntry.onCalendar === false ? PALETTE.inkSoft : PALETTE.sage }}
                        title="캘린더에 표시"
                      >
                        {dEntry.onCalendar === false ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => setMovingDiaryId(movingDiaryId === dEntry.id ? null : dEntry.id)}
                        style={{ color: movingDiaryId === dEntry.id ? PALETTE.sage : PALETTE.inkSoft }}
                      >
                        <CalendarClock size={14} />
                      </button>
                      <button onClick={() => removeDiary(dEntry.id)} style={{ color: PALETTE.coral }}>
                        <X size={14} />
                      </button>
                    </div>
                    {dEntry.title && (
                      <div className="text-sm font-bold pr-16" style={{ color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}>
                        {dEntry.title}
                      </div>
                    )}
                    {dEntry.author && (
                      <div className="text-xs mt-0.5" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
                        {dEntry.author} 기록
                      </div>
                    )}
                    {(dEntry.placeIds && dEntry.placeIds.length > 0 ? dEntry.placeIds : dEntry.placeId ? [dEntry.placeId] : [])
                      .map((pid) => places.find((p) => p.id === pid))
                      .filter(Boolean)
                      .map((pl) => (
                        <div key={pl.id} className="flex items-center gap-1 mt-0.5" style={{ color: PALETTE.sageDeep }}>
                          <MapPin size={11} />
                          <span className="text-xs" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
                            {pl.name}
                          </span>
                          <a href={googleMapsUrl(pl.name)} target="_blank" rel="noopener noreferrer" style={{ color: PALETTE.inkSoft }}>
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      ))}
                    {dEntry.journal && (
                      <div
                        className="text-sm leading-relaxed pr-12 mt-0.5"
                        style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif", fontStyle: "italic" }}
                      >
                        {dEntry.journal}
                      </div>
                    )}
                    {dEntry.photo && (
                      <div className="relative mt-2">
                        <img src={dEntry.photo} alt="일기 사진" className="w-full rounded-xl object-cover" style={{ maxHeight: "180px" }} />
                        <button
                          onClick={() => downloadPhoto(dEntry.photo, `${selected}-diary.jpg`)}
                          className="absolute bottom-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow-md"
                          style={{ background: "white", color: PALETTE.sageDeep }}
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    )}
                    {(dEntry.comments || []).length > 0 && (
                      <div className="mt-2 space-y-1.5 pt-2" style={{ borderTop: `1px solid ${PALETTE.line}` }}>
                        {dEntry.comments.map((c) =>
                          editingCommentId === c.id ? (
                            <div key={c.id} className="flex items-center gap-1.5">
                              <input
                                value={editingCommentText}
                                onChange={(e) => setEditingCommentText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveEditComment(dEntry.id, c.id)}
                                className="flex-1 px-2 py-1 rounded-lg text-xs focus:outline-none"
                                style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                              />
                              <button onClick={() => saveEditComment(dEntry.id, c.id)} style={{ color: PALETTE.sage }}>
                                <Check size={13} />
                              </button>
                              <button onClick={cancelEditComment} style={{ color: PALETTE.inkSoft }}>
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <div key={c.id} className="flex items-start justify-between gap-2 group/comment">
                              <div className="text-xs" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
                                <span style={{ color: PALETTE.sageDeep, fontWeight: 700 }}>{c.author}</span> {c.text}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover/comment:opacity-100 transition-opacity flex-shrink-0">
                                <button onClick={() => startEditComment(c.id, c.text)} style={{ color: PALETTE.inkSoft }}>
                                  <Pencil size={11} />
                                </button>
                                <button onClick={() => removeComment(dEntry.id, c.id)} style={{ color: PALETTE.coral }}>
                                  <X size={11} />
                                </button>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <select
                        value={getCommentDraft(dEntry.id).author}
                        onChange={(e) => updateCommentDraft(dEntry.id, { author: e.target.value })}
                        className="px-1.5 py-1 rounded-lg text-xs flex-shrink-0 focus:outline-none"
                        style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                      >
                        {WHO_OPTIONS.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                      <input
                        value={getCommentDraft(dEntry.id).text}
                        onChange={(e) => updateCommentDraft(dEntry.id, { text: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && addComment(dEntry.id)}
                        placeholder="댓글 남기기"
                        className="flex-1 px-2 py-1 rounded-lg text-xs focus:outline-none"
                        style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                      />
                      <button
                        onClick={() => addComment(dEntry.id)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: PALETTE.sage, color: "white" }}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    {movingDiaryId === dEntry.id && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <input
                          type="date"
                          defaultValue={selected}
                          onChange={(e) => moveDiary(dEntry.id, e.target.value)}
                          className="px-2 py-1 rounded-lg text-xs focus:outline-none"
                          style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                        />
                        <span className="text-xs" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>날짜 선택 시 바로 이동돼요</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowDiaryForm((v) => !v)}
            className="w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 mb-1.5"
            style={{
              background: showDiaryForm ? PALETTE.paperDeep : PALETTE.sage,
              color: showDiaryForm ? PALETTE.inkSoft : PALETTE.paper,
              fontFamily: "'Noto Sans KR', sans-serif",
            }}
          >
            {showDiaryForm ? (
              <>
                <X size={16} /> 입력 닫기
              </>
            ) : (
              <>
                <Plus size={16} /> 일기 추가
              </>
            )}
          </button>

          {showDiaryForm && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <input
                value={diaryTitleInput}
                onChange={(ev) => setDiaryTitleInput(ev.target.value)}
                placeholder="일기 제목 (선택)"
                className="flex-1 px-3 py-2 rounded-xl text-sm font-bold focus:outline-none"
                style={{ background: "white", color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
              />
              <select
                value={diaryAuthorInput}
                onChange={(ev) => setDiaryAuthorInput(ev.target.value)}
                className="px-2 py-2 rounded-xl text-sm flex-shrink-0 focus:outline-none"
                style={{ background: "white", color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
              >
                {WHO_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              {diaryPlaceInputs.map((val, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <MapPin size={13} style={{ color: PALETTE.sageDeep, flexShrink: 0 }} />
                  <input
                    value={val}
                    onChange={(ev) => updateDiaryPlaceInput(idx, ev.target.value)}
                    placeholder="지역)장소 예: 진주)경남정보고등학교"
                    list="diary-place-suggestions"
                    className="flex-1 px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                    style={{ background: "white", color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                  />
                  {idx === diaryPlaceInputs.length - 1 ? (
                    <button
                      type="button"
                      onClick={addDiaryPlaceInputField}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: PALETTE.paperDeep, color: PALETTE.sageDeep }}
                    >
                      <Plus size={14} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeDiaryPlaceInputField(idx)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: PALETTE.paperDeep, color: PALETTE.coral }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              ))}
              <datalist id="diary-place-suggestions">
                {places.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>
            <textarea
              value={journalInput}
              onChange={(ev) => setJournalInput(ev.target.value)}
              placeholder="오늘의 짧은 일기…"
              rows={2}
              className="w-full px-3 py-2 rounded-xl text-sm resize-none focus:outline-none"
              style={{ background: "white", color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
            />

            {photoInput ? (
              <div className="relative">
                <img src={photoInput} alt="첨부 미리보기" className="w-full rounded-xl object-cover" style={{ maxHeight: "140px" }} />
                <button
                  onClick={() => setPhotoInput(null)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "white", color: PALETTE.coral }}
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current && fileRef.current.click()}
                disabled={photoBusy}
                className="w-full py-2 rounded-xl text-sm flex items-center justify-center gap-1.5"
                style={{ background: "white", color: PALETTE.inkSoft, border: `1px dashed ${PALETTE.line}`, fontFamily: "'Noto Sans KR', sans-serif" }}
              >
                <ImageIcon size={15} /> {photoBusy ? "처리 중…" : "사진 첨부"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoPick} className="hidden" />

            <label className="flex items-center gap-1.5 text-xs" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
              <input type="checkbox" checked={diaryOnCalendarInput} onChange={(ev) => setDiaryOnCalendarInput(ev.target.checked)} />
              캘린더에 제목 표시
            </label>

            <button
              onClick={addDiary}
              className="w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
              style={{ background: PALETTE.sage, color: PALETTE.paper, fontFamily: "'Noto Sans KR', sans-serif" }}
            >
              <Plus size={15} /> 일기 남기기
            </button>
          </div>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

function PlaceBoard({ data, persist }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", region: "", rating: 5, review: "", best: false });
  const [filterBest, setFilterBest] = useState(false);
  const [sortMode, setSortMode] = useState("recent");

  const places = data.places || [];

  const addPlace = () => {
    if (!form.name.trim()) return;
    const next = { ...data };
    next.places = [
      ...(next.places || []),
      {
        id: Date.now().toString(36),
        name: form.name.trim(),
        region: form.region.trim(),
        review: form.review.trim(),
        rating: form.rating,
        best: form.best,
        addedAt: new Date().toISOString(),
      },
    ];
    persist(next);
    setForm({ name: "", region: "", rating: 5, review: "", best: false });
    setShowForm(false);
  };

  const removePlace = (id) => {
    const next = { ...data, places: (data.places || []).filter((p) => p.id !== id) };
    persist(next);
  };

  const toggleBest = (id) => {
    const next = { ...data, places: (data.places || []).map((p) => (p.id === id ? { ...p, best: !p.best } : p)) };
    persist(next);
  };

  const setPlaceRating = (id, rating) => {
    const next = { ...data, places: (data.places || []).map((p) => (p.id === id ? { ...p, rating } : p)) };
    persist(next);
  };

  const setPlaceRegion = (id, region) => {
    const next = { ...data, places: (data.places || []).map((p) => (p.id === id ? { ...p, region } : p)) };
    persist(next);
  };

  const visible = filterBest ? places.filter((p) => p.best) : places;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-3xl p-5" style={{ background: "white", border: `1px solid ${PALETTE.line}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>
            함께 다녀온 곳 ({places.length})
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterBest((f) => !f)}
              className="text-xs px-3 py-1.5 rounded-full flex items-center gap-1"
              style={{
                background: filterBest ? PALETTE.mustard : "transparent",
                color: filterBest ? "white" : PALETTE.inkSoft,
                border: `1px solid ${filterBest ? PALETTE.mustard : PALETTE.line}`,
                fontFamily: "'Noto Sans KR', sans-serif",
              }}
            >
              <Star size={12} fill={filterBest ? "white" : "none"} /> BEST만
            </button>
            <div className="flex gap-1">
              {[
                { key: "recent", label: "최신순" },
                { key: "rating", label: "별점순" },
                { key: "region", label: "지역별" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortMode(opt.key)}
                  className="text-[11px] px-2 py-1 rounded-full"
                  style={{
                    background: sortMode === opt.key ? PALETTE.sage : PALETTE.paperDeep,
                    color: sortMode === opt.key ? "white" : PALETTE.inkSoft,
                    fontFamily: "'Noto Sans KR', sans-serif",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2 mb-4" style={{ maxHeight: "440px", overflowY: "auto" }}>
          {visible.length === 0 && (
            <div className="text-sm py-6 text-center" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
              아직 등록된 장소가 없어요.
            </div>
          )}
          {[...visible]
            .sort((a, b) => {
              if (sortMode === "rating") return (b.rating || 0) - (a.rating || 0);
              if (sortMode === "region") return (a.region || a.name).localeCompare(b.region || b.name, "ko");
              return new Date(b.addedAt) - new Date(a.addedAt);
            })
            .map((p) => (
              <div key={p.id} className="rounded-2xl p-3" style={{ background: PALETTE.paperDeep }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.best && <Star size={13} fill={PALETTE.mustard} color={PALETTE.mustard} />}
                    <span className="text-sm font-medium" style={{ color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}>
                      {p.name}
                    </span>
                    <input
                      value={p.region || ""}
                      onChange={(e) => setPlaceRegion(p.id, e.target.value)}
                      placeholder="지역 입력"
                      className="text-[11px] px-1.5 py-0.5 rounded-full focus:outline-none"
                      style={{ background: "white", color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif", width: "72px" }}
                    />
                  </div>
                  <button onClick={() => removePlace(p.id)} style={{ color: PALETTE.coral }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <StarRow value={p.rating} size={14} onChange={(n) => setPlaceRating(p.id, n)} />
                {p.review && (
                  <p className="text-xs mt-1.5" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
                    {p.review}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1.5">
                  <button
                    onClick={() => toggleBest(p.id)}
                    className="text-[11px]"
                    style={{ color: PALETTE.sage, fontFamily: "'Noto Sans KR', sans-serif" }}
                  >
                    {p.best ? "베스트 해제" : "베스트로 표시"}
                  </button>
                  <a
                    href={googleMapsUrl(p.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] flex items-center gap-0.5"
                    style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}
                  >
                    <ExternalLink size={11} /> 구글맵에서 열기
                  </a>
                </div>
              </div>
            ))}
        </div>

        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 mb-1.5"
          style={{
            background: showForm ? PALETTE.paperDeep : PALETTE.sage,
            color: showForm ? PALETTE.inkSoft : "white",
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          {showForm ? (
            <>
              <X size={16} /> 입력 닫기
            </>
          ) : (
            <>
              <Plus size={16} /> 장소 추가
            </>
          )}
        </button>

        {showForm && (
          <div className="space-y-1.5">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="장소 이름"
              className="w-full px-2 py-1.5 rounded-lg text-sm focus:outline-none"
              style={{ background: PALETTE.paperDeep, fontFamily: "'Noto Sans KR', sans-serif" }}
            />
            <input
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              placeholder="지역 (예: 진주)"
              className="w-full px-2 py-1.5 rounded-lg text-sm focus:outline-none"
              style={{ background: PALETTE.paperDeep, fontFamily: "'Noto Sans KR', sans-serif" }}
            />
            <StarRow value={form.rating} onChange={(n) => setForm((f) => ({ ...f, rating: n }))} size={16} />
            <textarea
              value={form.review}
              onChange={(e) => setForm((f) => ({ ...f, review: e.target.value }))}
              placeholder="짧은 리뷰"
              rows={2}
              className="w-full px-2 py-1.5 rounded-lg text-sm resize-none focus:outline-none"
              style={{ background: PALETTE.paperDeep, fontFamily: "'Noto Sans KR', sans-serif" }}
            />
            <label className="flex items-center gap-1.5 text-xs" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
              <input type="checkbox" checked={form.best} onChange={(e) => setForm((f) => ({ ...f, best: e.target.checked }))} />
              베스트 장소로 표시
            </label>
            <button
              onClick={addPlace}
              className="w-full py-2 rounded-xl text-sm font-medium"
              style={{ background: PALETTE.sage, color: "white", fontFamily: "'Noto Sans KR', sans-serif" }}
            >
              추가
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const STOCK_CATEGORIES = ["식품", "생활용품"];
const STOCK_STORAGE = ["냉장", "냉동", "실온"];
const STORAGE_COLORS = {
  냉장: { bg: "#E1F5EE", text: "#0F6E56" },
  냉동: { bg: "#F9DCEA", text: "#9C1B5E" },
  실온: { bg: "#F2EBDD", text: "#5C6B6B" },
};
const CATEGORY_COLORS = {
  식품: { bg: "#DCE9F7", text: "#1B4D8C" },
  생활용품: { bg: "#FAEEDA", text: "#854F0B" },
};

function StockTab({ data, persist }) {
  const [nameInput, setNameInput] = useState("");
  const [categoryInput, setCategoryInput] = useState(STOCK_CATEGORIES[0]);
  const [storageInput, setStorageInput] = useState(STOCK_STORAGE[0]);
  const [expiryInput, setExpiryInput] = useState("");
  const [quantityInput, setQuantityInput] = useState(1);
  const [minQtyInput, setMinQtyInput] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const stock = data.stock || [];

  const add = () => {
    if (!nameInput.trim()) return;
    const next = {
      ...data,
      stock: [
        ...stock,
        {
          id: Date.now().toString(36),
          name: nameInput.trim(),
          category: categoryInput,
          storage: storageInput,
          expiry: expiryInput || null,
          quantity: Math.max(0, quantityInput),
          minQty: Math.max(0, minQtyInput),
          addedAt: new Date().toISOString(),
        },
      ],
    };
    persist(next);
    setNameInput("");
    setExpiryInput("");
    setQuantityInput(1);
    setMinQtyInput(1);
    setShowForm(false);
  };

  const remove = (id) => {
    const next = { ...data, stock: stock.filter((s) => s.id !== id) };
    persist(next);
  };

  const addToShoppingIfLow = (item, nextShopping) => {
    if (item.quantity <= (item.minQty ?? 0)) {
      const alreadyThere = nextShopping.some((sh) => sh.text === item.name && !sh.done);
      if (!alreadyThere) {
        return [...nextShopping, { id: Date.now().toString(36), text: item.name, done: false }];
      }
    }
    return nextShopping;
  };

  const changeQuantity = (id, delta) => {
    const item = stock.find((s) => s.id === id);
    if (!item) return;
    const newQty = Math.max(0, (item.quantity ?? 1) + delta);
    const updatedItem = { ...item, quantity: newQty };
    let nextShopping = data.shopping || [];
    if (delta < 0) {
      nextShopping = addToShoppingIfLow(updatedItem, nextShopping);
    }
    const next = {
      ...data,
      stock: stock.map((s) => (s.id === id ? updatedItem : s)),
      shopping: nextShopping,
    };
    persist(next);
  };

  const soon = stock.filter((s) => s.expiry && new Date(s.expiry) - new Date(todayStr()) <= 3 * 86400000);
  const low = stock.filter((s) => (s.quantity ?? 1) <= (s.minQty ?? 0));
  const sorted = [...stock].sort((a, b) => {
    if (!a.expiry && !b.expiry) return 0;
    if (!a.expiry) return 1;
    if (!b.expiry) return -1;
    return a.expiry.localeCompare(b.expiry);
  });

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-3xl p-5" style={{ background: "white", border: `1px solid ${PALETTE.line}` }}>
        {soon.length > 0 && (
          <div className="rounded-2xl px-3.5 py-2.5 mb-2 text-xs" style={{ background: "#F2E4EA", color: "#8C1B5C", fontFamily: "'Noto Sans KR', sans-serif" }}>
            소비기한 임박 {soon.length}개 — {soon.map((s) => s.name).join(", ")}
          </div>
        )}
        {low.length > 0 && (
          <div className="rounded-2xl px-3.5 py-2.5 mb-4 text-xs" style={{ background: PALETTE.paperDeep, color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>
            재고 부족 {low.length}개 — {low.map((s) => s.name).join(", ")} (장보기에 자동 추가됨)
          </div>
        )}

        {stock.length === 0 ? (
          <div className="text-sm py-8 text-center" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
            등록된 재고가 없어요.
          </div>
        ) : (
          <table className="w-full border-collapse mb-4">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium px-2 pb-2" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif", borderBottom: `1px solid ${PALETTE.line}` }}>
                  항목
                </th>
                <th className="text-center text-xs font-medium px-2 pb-2" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif", borderBottom: `1px solid ${PALETTE.line}` }}>
                  보관
                </th>
                <th className="text-center text-xs font-medium px-2 pb-2" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif", borderBottom: `1px solid ${PALETTE.line}` }}>
                  수량
                </th>
                <th className="text-center text-xs font-medium px-2 pb-2" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif", borderBottom: `1px solid ${PALETTE.line}` }}>
                  유통기한
                </th>
                <th style={{ width: "28px", borderBottom: `1px solid ${PALETTE.line}` }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s) => {
                const catColor = CATEGORY_COLORS[s.category] || CATEGORY_COLORS["식품"];
                const storColor = STORAGE_COLORS[s.storage] || STORAGE_COLORS["실온"];
                const isSoon = s.expiry && new Date(s.expiry) - new Date(todayStr()) <= 3 * 86400000;
                return (
                  <tr key={s.id} className="group">
                    <td className="px-2 py-2" style={{ borderBottom: `1px solid ${PALETTE.paperDeep}` }}>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full mr-1.5"
                        style={{ background: catColor.bg, color: catColor.text, fontFamily: "'Noto Sans KR', sans-serif" }}
                      >
                        {s.category}
                      </span>
                      <span className="text-sm" style={{ color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}>
                        {s.name}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center" style={{ borderBottom: `1px solid ${PALETTE.paperDeep}` }}>
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full"
                        style={{ background: storColor.bg, color: storColor.text, fontFamily: "'Noto Sans KR', sans-serif" }}
                      >
                        {s.storage}
                      </span>
                    </td>
                    <td className="px-2 py-2" style={{ borderBottom: `1px solid ${PALETTE.paperDeep}` }}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => changeQuantity(s.id, -1)}
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: PALETTE.paperDeep, color: PALETTE.inkSoft }}
                        >
                          -
                        </button>
                        <span
                          className="text-xs w-4 text-center"
                          style={{
                            color: (s.quantity ?? 1) <= (s.minQty ?? 0) ? PALETTE.coral : PALETTE.ink,
                            fontWeight: (s.quantity ?? 1) <= (s.minQty ?? 0) ? 700 : 400,
                            fontFamily: "'Noto Sans KR', sans-serif",
                          }}
                        >
                          {s.quantity ?? 1}
                        </span>
                        <button
                          onClick={() => changeQuantity(s.id, 1)}
                          className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: PALETTE.paperDeep, color: PALETTE.inkSoft }}
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td
                      className="px-2 py-2 text-center text-xs"
                      style={{
                        borderBottom: `1px solid ${PALETTE.paperDeep}`,
                        color: s.expiry ? (isSoon ? "#9C1B5E" : PALETTE.inkSoft) : PALETTE.inkSoft,
                        fontWeight: isSoon ? 700 : 400,
                        fontFamily: "'Noto Sans KR', sans-serif",
                      }}
                    >
                      {s.expiry ? ddayLabel(s.expiry) : "-"}
                    </td>
                    <td className="px-2 py-2 text-center" style={{ borderBottom: `1px solid ${PALETTE.paperDeep}` }}>
                      <button onClick={() => remove(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: PALETTE.coral }}>
                        <X size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <button
          onClick={() => setShowForm((v) => !v)}
          className="w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 mb-1.5"
          style={{
            background: showForm ? PALETTE.paperDeep : PALETTE.sage,
            color: showForm ? PALETTE.inkSoft : "white",
            fontFamily: "'Noto Sans KR', sans-serif",
          }}
        >
          {showForm ? (
            <>
              <X size={16} /> 입력 닫기
            </>
          ) : (
            <>
              <Plus size={16} /> 재고 추가
            </>
          )}
        </button>

        {showForm && (
          <div className="space-y-1.5">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="항목 이름 (예: 우유)"
              className="w-full px-3 py-2 rounded-xl text-sm focus:outline-none"
              style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
            />
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                className="px-2 py-2 rounded-xl text-sm focus:outline-none"
                style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
              >
                {STOCK_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={storageInput}
                onChange={(e) => setStorageInput(e.target.value)}
                className="px-2 py-2 rounded-xl text-sm focus:outline-none"
                style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
              >
                {STOCK_STORAGE.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>
                  수량
                </span>
                <input
                  type="number"
                  min="0"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(parseInt(e.target.value, 10) || 0)}
                  className="flex-1 px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>
                  최소
                </span>
                <input
                  type="number"
                  min="0"
                  value={minQtyInput}
                  onChange={(e) => setMinQtyInput(parseInt(e.target.value, 10) || 0)}
                  className="flex-1 px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
                />
              </div>
            </div>
            <p className="text-xs" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
              수량이 최소 수량 이하로 줄면 장보기 목록에 자동으로 추가돼요.
            </p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs flex-shrink-0" style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif" }}>
                유통기한
              </span>
              <input
                type="date"
                value={expiryInput}
                onChange={(e) => setExpiryInput(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg text-sm focus:outline-none"
                style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
              />
            </div>
            <button
              onClick={add}
              className="w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5"
              style={{ background: PALETTE.sage, color: "white", fontFamily: "'Noto Sans KR', sans-serif" }}
            >
              <Plus size={16} /> 추가
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ShoppingTab({ data, persist }) {
  const [input, setInput] = useState("");
  const items = data.shopping || [];

  const add = () => {
    if (!input.trim()) return;
    const next = { ...data, shopping: [...items, { id: Date.now().toString(36), text: input.trim(), done: false }] };
    persist(next);
    setInput("");
  };

  const toggle = (id) => {
    const next = { ...data, shopping: items.map((it) => (it.id === id ? { ...it, done: !it.done } : it)) };
    persist(next);
  };

  const remove = (id) => {
    const next = { ...data, shopping: items.filter((it) => it.id !== id) };
    persist(next);
  };

  const clearDone = () => {
    const next = { ...data, shopping: items.filter((it) => !it.done) };
    persist(next);
  };

  const doneCount = items.filter((i) => i.done).length;

  return (
    <div className="max-w-xl mx-auto">
      <div className="rounded-3xl p-5" style={{ background: "white", border: `1px solid ${PALETTE.line}` }}>
        <div className="flex gap-2 mb-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="살 것을 적어보세요 (예: 우유)"
            className="flex-1 px-3 py-2.5 rounded-xl text-sm focus:outline-none"
            style={{ background: PALETTE.paperDeep, color: PALETTE.ink, fontFamily: "'Noto Sans KR', sans-serif" }}
          />
          <button
            onClick={add}
            className="px-4 rounded-xl flex items-center justify-center"
            style={{ background: PALETTE.sage, color: "white" }}
          >
            <Plus size={18} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="text-sm py-8 text-center" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
            장보기 목록이 비어 있어요.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th
                  className="text-left text-xs font-medium px-2 pb-2"
                  style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif", borderBottom: `1px solid ${PALETTE.line}` }}
                >
                  항목
                </th>
                <th
                  className="text-center text-xs font-medium px-2 pb-2"
                  style={{ color: PALETTE.sageDeep, fontFamily: "'Noto Sans KR', sans-serif", borderBottom: `1px solid ${PALETTE.line}`, width: "90px" }}
                >
                  구입완료
                </th>
                <th style={{ width: "32px", borderBottom: `1px solid ${PALETTE.line}` }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="group">
                  <td className="px-2 py-2" style={{ borderBottom: `1px solid ${PALETTE.paperDeep}` }}>
                    <span
                      className="text-sm"
                      style={{
                        color: it.done ? PALETTE.inkSoft : PALETTE.ink,
                        textDecoration: it.done ? "line-through" : "none",
                        fontFamily: "'Noto Sans KR', sans-serif",
                      }}
                    >
                      {it.text}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center" style={{ borderBottom: `1px solid ${PALETTE.paperDeep}` }}>
                    <button
                      onClick={() => toggle(it.id)}
                      className="w-5 h-5 rounded-full flex items-center justify-center mx-auto"
                      style={{
                        background: it.done ? PALETTE.sage : "transparent",
                        border: `1.5px solid ${it.done ? PALETTE.sage : PALETTE.line}`,
                      }}
                    >
                      {it.done && <Check size={12} color="white" />}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-center" style={{ borderBottom: `1px solid ${PALETTE.paperDeep}` }}>
                    <button
                      onClick={() => remove(it.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: PALETTE.coral }}
                    >
                      <X size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {doneCount > 0 && (
          <button
            onClick={clearDone}
            className="w-full mt-4 py-2 rounded-xl text-xs"
            style={{ background: PALETTE.paperDeep, color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}
          >
            완료한 {doneCount}개 지우기
          </button>
        )}
      </div>
    </div>
  );
}

export default function FamilyHub() {
  const { data, status, persist } = useFamilyData();
  const [tab, setTab] = useState("calendar");

  if (status === "loading" || !data) {
    return (
      <div className="w-full min-h-[500px] flex items-center justify-center" style={{ background: PALETTE.paper }}>
        <span style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }} className="text-sm">
          불러오는 중…
        </span>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen" style={{ background: PALETTE.paper }}>
      <div className="max-w-4xl mx-auto px-5 py-8">
        <div className="mb-6">
          <div className="flex items-baseline gap-2">
            <h1 style={{ fontFamily: "'Noto Sans KR', sans-serif", color: PALETTE.ink, fontStyle: "italic" }} className="text-3xl">
              댕구호
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: PALETTE.inkSoft, fontFamily: "'Noto Sans KR', sans-serif" }}>
            일정과 일기, 함께 다녀온 곳, 장보기까지 — 같이 쓰는 공간
          </p>
        </div>

        <div
          className="flex gap-1 mb-6 p-1.5 rounded-full w-fit max-w-full overflow-x-auto"
          style={{ background: PALETTE.paperDeep, border: `1px solid ${PALETTE.line}` }}
        >
          <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")} icon={Calendar} label="캘린더" />
          <TabButton active={tab === "map"} onClick={() => setTab("map")} icon={MapPin} label="다녀온 곳" />
          <TabButton active={tab === "shopping"} onClick={() => setTab("shopping")} icon={ShoppingBag} label="장보기" />
          <TabButton active={tab === "stock"} onClick={() => setTab("stock")} icon={Package} label="재고" />
        </div>

        {tab === "calendar" && <CalendarTab data={data} persist={persist} />}
        {tab === "map" && <PlaceBoard data={data} persist={persist} />}
        {tab === "shopping" && <ShoppingTab data={data} persist={persist} />}
        {tab === "stock" && <StockTab data={data} persist={persist} />}
      </div>
    </div>
  );
}
