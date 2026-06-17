import os
import re
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)

DB_PATH = os.environ.get('STAX_DB', os.path.join(os.path.dirname(__file__), 'scores.db'))

_LOCALHOST_ORIGINS = {
    'http://localhost',
    'http://localhost:8765',
    'http://127.0.0.1',
    'http://127.0.0.1:8765',
}

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri='memory://',
)


def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db():
    conn = _connect()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS scores (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT NOT NULL,
            score      INTEGER NOT NULL,
            level      INTEGER NOT NULL,
            lines      INTEGER NOT NULL,
            date       TEXT NOT NULL,
            ip         TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    ''')
    conn.commit()
    conn.close()


def _top10():
    conn = _connect()
    rows = conn.execute(
        'SELECT name, score, level, lines, date FROM scores ORDER BY score DESC LIMIT 10'
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.after_request
def _cors(response):
    origin = request.headers.get('Origin', '')
    if origin in _LOCALHOST_ORIGINS:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


@app.route('/', methods=['OPTIONS'])
def _options():
    return '', 204


@app.route('/', methods=['GET'])
@limiter.limit('200 per minute')
def get_scores():
    return jsonify(_top10())


@app.route('/', methods=['POST'])
@limiter.limit('1 per 10 seconds')
def post_score():
    data = request.get_json(silent=True) or {}

    raw_name = str(data.get('name', ''))
    name = re.sub(r'[\x00-\x1f\x7f]', '', raw_name).strip()[:12] or 'Anonymous'

    score = data.get('score')
    level = data.get('level')
    lines = data.get('lines')

    if not isinstance(score, int) or isinstance(score, bool):
        return jsonify({'ok': False, 'error': 'Invalid score'}), 400
    if not isinstance(level, int) or isinstance(level, bool):
        return jsonify({'ok': False, 'error': 'Invalid level'}), 400
    if not isinstance(lines, int) or isinstance(lines, bool):
        return jsonify({'ok': False, 'error': 'Invalid lines'}), 400
    if not (0 <= score <= 10_000_000):
        return jsonify({'ok': False, 'error': 'Score out of range'}), 400
    if not (1 <= level <= 20):
        return jsonify({'ok': False, 'error': 'Level out of range'}), 400
    if not (0 <= lines <= 2000):
        return jsonify({'ok': False, 'error': 'Lines out of range'}), 400

    conn = _connect()
    conn.execute(
        'INSERT INTO scores (name, score, level, lines, date, ip) VALUES (?, ?, ?, ?, ?, ?)',
        (name, score, level, lines, datetime.now().strftime('%Y-%m-%d'), request.remote_addr),
    )
    conn.commit()
    conn.close()

    return jsonify({'ok': True, 'scores': _top10()})


@app.errorhandler(429)
def _ratelimit(e):
    return jsonify({'ok': False, 'error': 'Rate limit exceeded'}), 429


with app.app_context():
    _init_db()
