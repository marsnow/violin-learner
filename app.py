import json
import os
import random
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


ROOT = Path(__file__).parent
STATIC_DIR = ROOT / "static"
DATABASE_PATH = Path(os.environ.get("SIGHTLINE_DB", ROOT / "practice.db"))
PORT = int(os.environ.get("SIGHTLINE_PORT", "8000"))
QUESTION_COUNT = 20

NOTE_NAMES = (
    ("C", "Do"),
    ("D", "Re"),
    ("E", "Mi"),
    ("F", "Fa"),
    ("G", "Sol"),
    ("A", "La"),
    ("B", "Si"),
)
NOTE_INDEX = {letter: index for index, (letter, _) in enumerate(NOTE_NAMES)}
NOTE_RANGES = {
    "first_to_third": (("G", 3), ("E", 6)),
}
ACTIVE_NOTE_RANGE = "first_to_third"

LEVELS = (
    {"id": "position-1", "label": "第一把位", "kind": "position", "position": 1, "start": ("G", 3), "end": ("B", 5)},
    {"id": "position-2", "label": "第二把位", "kind": "position", "position": 2, "start": ("B", 3), "end": ("C", 6)},
    {"id": "position-3", "label": "第三把位", "kind": "position", "position": 3, "start": ("C", 4), "end": ("E", 6)},
    {"id": "review-1-3", "label": "一至三把位複習", "kind": "review", "position": None, "start": ("G", 3), "end": ("E", 6)},
    {"id": "position-4", "label": "第四把位", "kind": "position", "position": 4, "start": ("D", 4), "end": ("F", 6)},
    {"id": "position-5", "label": "第五把位", "kind": "position", "position": 5, "start": ("E", 4), "end": ("G", 6)},
    {"id": "position-6", "label": "第六把位", "kind": "position", "position": 6, "start": ("F", 4), "end": ("A", 6)},
    {"id": "review-4-6", "label": "四至六把位複習", "kind": "review", "position": None, "start": ("D", 4), "end": ("A", 6)},
    {"id": "position-7", "label": "第七把位", "kind": "position", "position": 7, "start": ("G", 4), "end": ("B", 6)},
    {"id": "review-all", "label": "總複習", "kind": "total", "position": None, "start": ("G", 3), "end": ("B", 6)},
)
LEVEL_BY_ID = {level["id"]: level for level in LEVELS}
DEFAULT_LEVEL_ID = "position-1"


def build_notes(note_range):
    start, end = note_range
    start_index = start[1] * 7 + NOTE_INDEX[start[0]]
    end_index = end[1] * 7 + NOTE_INDEX[end[0]]
    notes = []
    for octave in range(3, 7):
        for letter, solfege in NOTE_NAMES:
            current_index = octave * 7 + NOTE_INDEX[letter]
            if start_index <= current_index <= end_index:
                notes.append(
                    {
                        "id": f"{letter}{octave}",
                        "letter": letter,
                        "solfege": solfege,
                        "staff_position": (octave - 4) * 7 + NOTE_INDEX[letter] - 2,
                    }
                )
    return tuple(notes)


NOTES = build_notes(NOTE_RANGES[ACTIVE_NOTE_RANGE])
ALL_NOTES = build_notes((("G", 3), ("B", 6)))
NOTE_BY_ID = {note["id"]: note for note in ALL_NOTES}


def get_level(level_id):
    return LEVEL_BY_ID.get(level_id)


def notes_for_level(level_id):
    level = get_level(level_id)
    return build_notes((level["start"], level["end"]))


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level_id TEXT NOT NULL DEFAULT 'position-1',
                question_number INTEGER NOT NULL DEFAULT 1,
                note_id TEXT NOT NULL,
                letter_answer TEXT NOT NULL,
                solfege_answer TEXT NOT NULL,
                letter_correct INTEGER NOT NULL,
                solfege_correct INTEGER NOT NULL,
                fully_correct INTEGER NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        columns = {row["name"] for row in connection.execute("PRAGMA table_info(attempts)")}
        if "level_id" not in columns:
            connection.execute("ALTER TABLE attempts ADD COLUMN level_id TEXT NOT NULL DEFAULT 'position-1'")
        if "question_number" not in columns:
            connection.execute("ALTER TABLE attempts ADD COLUMN question_number INTEGER NOT NULL DEFAULT 1")


def practice_weight(attempts, mistakes):
    return round(1 + mistakes * 2 + (0.5 if attempts == 0 else 0), 2)


def choose_note(level_id=DEFAULT_LEVEL_ID):
    note_pool = notes_for_level(level_id)
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT note_id, COUNT(*) AS attempts,
                   SUM(CASE WHEN fully_correct = 0 THEN 1 ELSE 0 END) AS mistakes
            FROM attempts
            WHERE level_id = ?
            GROUP BY note_id
            """,
            (level_id,),
        ).fetchall()
    stats = {row["note_id"]: row for row in rows}
    weights = [
        practice_weight(
            stats[note["id"]]["attempts"] if note["id"] in stats else 0,
            stats[note["id"]]["mistakes"] if note["id"] in stats else 0,
        )
        for note in note_pool
    ]
    return random.choices(note_pool, weights=weights, k=1)[0]


def report_data(level_id=DEFAULT_LEVEL_ID):
    note_pool = notes_for_level(level_id)
    with get_connection() as connection:
        total = connection.execute(
            """
            SELECT COUNT(*) AS attempts,
                   COALESCE(SUM(fully_correct), 0) AS fully_correct,
                   COALESCE(SUM(letter_correct), 0) AS letter_correct,
                   COALESCE(SUM(solfege_correct), 0) AS solfege_correct
            FROM attempts
            WHERE level_id = ?
            """,
            (level_id,),
        ).fetchone()
        rows = connection.execute(
            """
            SELECT note_id,
                   COUNT(*) AS attempts,
                   SUM(fully_correct) AS fully_correct,
                   SUM(letter_correct) AS letter_correct,
                   SUM(solfege_correct) AS solfege_correct
            FROM attempts
            WHERE level_id = ?
            GROUP BY note_id
            """,
            (level_id,),
        ).fetchall()

    stats = {row["note_id"]: row for row in rows}
    notes = []
    for note in note_pool:
        row = stats.get(note["id"])
        attempts = row["attempts"] if row else 0
        fully_correct = row["fully_correct"] if row else 0
        letter_correct = row["letter_correct"] if row else 0
        solfege_correct = row["solfege_correct"] if row else 0
        mistakes = attempts - fully_correct
        notes.append(
            {
                **note,
                "attempts": attempts,
                "fully_correct": fully_correct,
                "letter_correct": letter_correct,
                "solfege_correct": solfege_correct,
                "mistakes": mistakes,
                "letter_errors": attempts - letter_correct,
                "solfege_errors": attempts - solfege_correct,
                "accuracy": round(fully_correct / attempts * 100) if attempts else 0,
                "practice_weight": practice_weight(attempts, mistakes),
            }
        )

    attempts = total["attempts"]
    return {
        "summary": {
            "attempts": attempts,
            "fully_correct": total["fully_correct"],
            "letter_correct": total["letter_correct"],
            "solfege_correct": total["solfege_correct"],
            "accuracy": round(total["fully_correct"] / attempts * 100) if attempts else 0,
        },
        "notes": notes,
    }


def levels_data():
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT level_id,
                   COUNT(*) AS attempts,
                   COALESCE(SUM(fully_correct), 0) AS fully_correct
            FROM attempts
            GROUP BY level_id
            """
        ).fetchall()
    stats_by_level = {row["level_id"]: row for row in rows}
    data = []
    for level in LEVELS:
        row = stats_by_level.get(level["id"])
        attempts = row["attempts"] if row else 0
        fully_correct = row["fully_correct"] if row else 0
        data.append(
            {
                "id": level["id"],
                "label": level["label"],
                "kind": level["kind"],
                "position": level["position"],
                "range_label": f"{level['start'][0]}{level['start'][1]}–{level['end'][0]}{level['end'][1]}",
                "question_count": QUESTION_COUNT,
                "attempts": attempts,
                "fully_correct": fully_correct,
                "accuracy": round(fully_correct / attempts * 100) if attempts else 0,
                "mistakes": attempts - fully_correct,
                "completed": attempts >= QUESTION_COUNT,
            }
        )
    return data


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        request = urlparse(self.path)
        path = request.path
        query = parse_qs(request.query)
        level_id = query.get("level_id", [DEFAULT_LEVEL_ID])[0]
        level = get_level(level_id)
        if path in {"/api/question", "/api/report"} and not level:
            json_response(self, 400, {"error": "Invalid level"})
            return
        if path == "/api/levels":
            json_response(self, 200, {"levels": levels_data(), "question_count": QUESTION_COUNT})
            return
        if path == "/api/question":
            note = choose_note(level_id)
            json_response(
                self,
                200,
                {
                    "id": note["id"],
                    "level_id": level_id,
                    "range_label": f"{level['start'][0]}{level['start'][1]}–{level['end'][0]}{level['end'][1]}",
                    "staff_position": note["staff_position"],
                    "total_questions": QUESTION_COUNT,
                },
            )
            return
        if path == "/api/report":
            json_response(self, 200, report_data(level_id))
            return
        self.serve_static(path)

    def do_POST(self):
        if urlparse(self.path).path != "/api/attempt":
            json_response(self, 404, {"error": "Not found"})
            return
        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            if content_length > 2048:
                raise ValueError("Request is too large")
            payload = json.loads(self.rfile.read(content_length))
            level_id = payload["level_id"]
            level = get_level(level_id)
            question_number = int(payload.get("question_number", 1))
            if not level or not 1 <= question_number <= QUESTION_COUNT:
                raise ValueError("Invalid level or question number")
            note = NOTE_BY_ID[payload["note_id"]]
            if note["id"] not in {item["id"] for item in notes_for_level(level_id)}:
                raise ValueError("Note is not in this level")
            letter_answer = str(payload["letter_answer"])
            solfege_answer = str(payload["solfege_answer"])
            if letter_answer not in {item[0] for item in NOTE_NAMES}:
                raise ValueError("Invalid letter answer")
            if solfege_answer not in {item[1] for item in NOTE_NAMES}:
                raise ValueError("Invalid solfege answer")
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            json_response(self, 400, {"error": "Invalid answer"})
            return

        letter_correct = int(letter_answer == note["letter"])
        solfege_correct = int(solfege_answer == note["solfege"])
        fully_correct = int(letter_correct and solfege_correct)
        with get_connection() as connection:
            connection.execute(
                """
                INSERT INTO attempts (
                    level_id, question_number, note_id, letter_answer, solfege_answer,
                    letter_correct, solfege_correct, fully_correct
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    level_id,
                    question_number,
                    note["id"],
                    letter_answer,
                    solfege_answer,
                    letter_correct,
                    solfege_correct,
                    fully_correct,
                ),
            )
        json_response(
            self,
            200,
            {
                "level_id": level_id,
                "question_number": question_number,
                "total_questions": QUESTION_COUNT,
                "note_id": note["id"],
                "correct_letter": note["letter"],
                "correct_solfege": note["solfege"],
                "letter_correct": bool(letter_correct),
                "solfege_correct": bool(solfege_correct),
                "fully_correct": bool(fully_correct),
            },
        )

    def serve_static(self, path):
        relative_path = "index.html" if path == "/" else path.lstrip("/")
        requested_file = (STATIC_DIR / relative_path).resolve()
        if STATIC_DIR not in requested_file.parents or not requested_file.is_file():
            json_response(self, 404, {"error": "Not found"})
            return
        content_type = {
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
            ".html": "text/html; charset=utf-8",
        }.get(requested_file.suffix, "application/octet-stream")
        body = requested_file.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format_string, *args):
        return


if __name__ == "__main__":
    init_db()
    server = ThreadingHTTPServer(("127.0.0.1", PORT), RequestHandler)
    print(f"Sightline running at http://127.0.0.1:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
